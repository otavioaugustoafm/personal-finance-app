from datetime import date
from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from psycopg.errors import ForeignKeyViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/transacoes", tags=["Transacoes"], dependencies=[Depends(exigir_acesso)])


class TransacaoUpdate(BaseModel):
    categoria_id: UUID | None = None  # null explicito remove a categoria
    ignorar_no_fluxo: bool | None = None


class CategorizarEmLote(BaseModel):
    ids: list[UUID] = Field(..., min_length=1, max_length=500)
    categoria_id: UUID | None = None  # null remove a categoria de todas


def _erro_interno(erro: Exception) -> HTTPException:
    print(f"Erro em transacoes: {erro}")
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")


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
                f"""SELECT t.id, t.data, t.descricao, t.valor, t.direcao, t.metodo, t.status,
                           t.parcela_atual, t.total_parcelas, t.ignorar_no_fluxo,
                           t.categoria_id, c.nome AS categoria_nome, c.cor AS categoria_cor,
                           ct.id AS conta_id, ct.nome AS conta_nome, ct.tipo AS conta_tipo
                      FROM transacoes t
                      JOIN contas ct ON ct.id = t.conta_id
                      LEFT JOIN categorias c ON c.id = t.categoria_id
                     WHERE {onde}
                     ORDER BY t.data DESC, t.criado_em DESC
                     LIMIT %s OFFSET %s""",
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
    """Atribui (ou remove) a categoria e/ou marca a transacao para ficar fora do fluxo de caixa."""
    campos = payload.model_fields_set & {"categoria_id", "ignorar_no_fluxo"}
    if not campos:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Nada para atualizar.")
    if "ignorar_no_fluxo" in campos and payload.ignorar_no_fluxo is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="ignorar_no_fluxo deve ser true ou false.")

    sets = [f"{campo} = %s" for campo in sorted(campos)]  # nomes vem da lista fixa acima, nunca do cliente
    valores = [getattr(payload, campo) for campo in sorted(campos)]
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"UPDATE transacoes SET {', '.join(sets)}, atualizado_em = now() WHERE id = %s "
                "RETURNING id, categoria_id, ignorar_no_fluxo",
                valores + [transacao_id],
            )
            linha = cur.fetchone()
            if not linha:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Transacao nao encontrada.")
            return linha
    except ForeignKeyViolation:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria inexistente.")
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
