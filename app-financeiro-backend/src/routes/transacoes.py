from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg.errors import ForeignKeyViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, model_validator

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/transacoes", tags=["Transacoes"], dependencies=[Depends(exigir_acesso)])

# Campos que voce pode editar e que a sincronizacao passa a respeitar (ver src/sync.py)
CAMPOS_EDITAVEIS = ("descricao", "data", "valor", "direcao", "metodo", "parcela_atual", "total_parcelas")
CAMPOS_NAO_NULOS = ("descricao", "data", "valor", "direcao", "metodo")

COLUNAS = """t.id, t.data, t.descricao, t.valor, t.direcao, t.metodo, t.status,
             t.parcela_atual, t.total_parcelas, t.ignorar_no_fluxo, t.campos_editados, t.original,
             t.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
             ct.id AS conta_id, ct.nome AS conta_nome, ct.tipo AS conta_tipo"""
JUNCOES = """FROM transacoes t
             JOIN contas ct ON ct.id = t.conta_id
             LEFT JOIN categorias c ON c.id = t.categoria_id"""


class TransacaoUpdate(BaseModel):
    """Todos os campos sao opcionais: so o que for enviado muda. Enviar null so vale para categoria e parcelas."""
    categoria_id: UUID | None = None
    ignorar_no_fluxo: bool | None = None
    descricao: str | None = Field(default=None, min_length=1, max_length=200)
    data: date | None = None
    valor: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    direcao: Literal["ENTRADA", "SAIDA"] | None = None
    metodo: Literal["PIX", "DEBITO", "CREDITO", "OUTRO"] | None = None
    parcela_atual: int | None = Field(default=None, ge=1, le=999)
    total_parcelas: int | None = Field(default=None, ge=1, le=999)

    @model_validator(mode="after")
    def _parcelas_coerentes(self):
        if self.parcela_atual and self.total_parcelas and self.parcela_atual > self.total_parcelas:
            raise ValueError("A parcela atual nao pode ser maior que o total de parcelas.")
        return self


class CategorizarEmLote(BaseModel):
    ids: list[UUID] = Field(..., min_length=1, max_length=500)
    categoria_id: UUID | None = None  # null remove a categoria de todas


def _erro_interno(erro: Exception) -> HTTPException:
    print(f"Erro em transacoes: {erro}")
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")


def _linha(cur, transacao_id) -> dict | None:
    cur.execute(f"SELECT {COLUNAS} {JUNCOES} WHERE t.id = %s", (transacao_id,))
    return cur.fetchone()


def _como_no_original(campo: str, valor):
    """Converte para o mesmo formato guardado em `original` (texto para data e valor)."""
    if campo == "data":
        return valor.isoformat()
    if campo == "valor":
        return f"{valor:.2f}"
    return valor


def _do_original(campo: str, valor):
    if campo == "data":
        return date.fromisoformat(valor)
    if campo == "valor":
        return Decimal(valor)
    return valor


@router.get("")
def listar(
    de: date | None = None,
    ate: date | None = None,
    direcao: str | None = Query(default=None, pattern="^(ENTRADA|SAIDA)$"),
    categoria_id: UUID | None = None,
    sem_categoria: bool = False,
    incluir_ignoradas: bool = False,
    limite: int = Query(default=500, ge=1, le=1000),
    deslocamento: int = Query(default=0, ge=0),
):
    """Transacoes (mais recentes primeiro) e, para o mesmo filtro, o total de entradas e saidas
    (sem contar as marcadas como 'ignorar no fluxo', como pagamento de fatura)."""
    filtros, params = ["t.sumiu_em IS NULL"], []
    if de:
        filtros.append("t.data >= %s"); params.append(de)
    if ate:
        filtros.append("t.data <= %s"); params.append(ate)
    if direcao:
        filtros.append("t.direcao = %s"); params.append(direcao)
    if categoria_id:
        filtros.append("t.categoria_id = %s"); params.append(categoria_id)
    if sem_categoria:
        filtros.append("t.categoria_id IS NULL")
    if not incluir_ignoradas:
        filtros.append("NOT t.ignorar_no_fluxo")
    onde = " AND ".join(filtros)

    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"SELECT {COLUNAS} {JUNCOES} WHERE {onde} ORDER BY t.data DESC, t.criado_em DESC LIMIT %s OFFSET %s",
                params + [limite, deslocamento],
            )
            transacoes = cur.fetchall()
            cur.execute(
                f"""SELECT COALESCE(SUM(t.valor) FILTER (WHERE t.direcao = 'ENTRADA'), 0) AS entradas,
                           COALESCE(SUM(t.valor) FILTER (WHERE t.direcao = 'SAIDA'), 0)   AS saidas,
                           COUNT(*) AS quantidade
                      FROM transacoes t WHERE {onde}""",
                params,
            )
            return {"transacoes": transacoes, "totais": cur.fetchone()}
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.patch("/{transacao_id}")
def atualizar(transacao_id: UUID, payload: TransacaoUpdate):
    """Edita qualquer atributo da transacao (descricao, categoria, data, valor, tipo, forma, parcelas).
    O que voce editar fica protegido: a sincronizacao diaria nao volta ao valor do banco."""
    enviados = payload.model_fields_set & {"categoria_id", "ignorar_no_fluxo", *CAMPOS_EDITAVEIS}
    if not enviados:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Nada para atualizar.")
    for campo in enviados & {*CAMPOS_NAO_NULOS, "ignorar_no_fluxo"}:
        if getattr(payload, campo) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{campo} nao pode ser nulo.")

    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT original, campos_editados, parcela_atual, total_parcelas FROM transacoes WHERE id = %s FOR UPDATE", (transacao_id,))
            atual = cur.fetchone()
            if not atual:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Transacao nao encontrada.")

            # parcelas: a regra "atual <= total" vale tambem quando so um dos dois foi enviado
            pa = payload.parcela_atual if "parcela_atual" in enviados else atual["parcela_atual"]
            tp = payload.total_parcelas if "total_parcelas" in enviados else atual["total_parcelas"]
            if pa and tp and pa > tp:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A parcela atual nao pode ser maior que o total.")

            editados = set(atual["campos_editados"])
            sets, valores = [], []
            for campo in sorted(enviados):
                novo = getattr(payload, campo)
                sets.append(f"{campo} = %s")  # nomes de colunas vem de listas fixas, nunca do cliente
                valores.append(novo)
                if campo in CAMPOS_EDITAVEIS:
                    igual_ao_banco = _como_no_original(campo, novo) == atual["original"].get(campo) if novo is not None else atual["original"].get(campo) is None
                    (editados.discard if igual_ao_banco else editados.add)(campo)  # voltou ao valor do banco = deixa de ser "editado"
            sets.append("campos_editados = %s")
            valores.append(sorted(editados))
            cur.execute(f"UPDATE transacoes SET {', '.join(sets)}, atualizado_em = now() WHERE id = %s", valores + [transacao_id])
            return _linha(cur, transacao_id)
    except ForeignKeyViolation:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria inexistente.")
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.post("/{transacao_id}/restaurar")
def restaurar(transacao_id: UUID):
    """Desfaz as edicoes de descricao, data, valor, tipo, forma e parcelas: volta ao que o banco informou.
    A categoria e o 'fora do fluxo' nao mudam."""
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("SELECT original FROM transacoes WHERE id = %s FOR UPDATE", (transacao_id,))
            linha = cur.fetchone()
            if not linha:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Transacao nao encontrada.")
            original = linha["original"]
            cur.execute(
                f"UPDATE transacoes SET {', '.join(f'{c} = %s' for c in CAMPOS_EDITAVEIS)}, "
                "campos_editados = '{}', atualizado_em = now() WHERE id = %s",
                [_do_original(c, original[c]) if original.get(c) is not None else None for c in CAMPOS_EDITAVEIS] + [transacao_id],
            )
            return _linha(cur, transacao_id)
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.post("/categorizar-em-lote")
def categorizar_em_lote(payload: CategorizarEmLote):
    """Atribui a mesma categoria a varias transacoes de uma vez (ate 500)."""
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE transacoes SET categoria_id = %s, atualizado_em = now() WHERE id = ANY(%s)",
                (payload.categoria_id, payload.ids),
            )
            return {"atualizadas": cur.rowcount}
    except ForeignKeyViolation:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria inexistente.")
    except psycopg.Error as erro:
        raise _erro_interno(erro)
