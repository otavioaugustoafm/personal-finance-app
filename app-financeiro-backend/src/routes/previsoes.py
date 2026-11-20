from decimal import Decimal
from typing import Literal
from uuid import UUID

import psycopg
from psycopg import errors as erros_pg
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from psycopg.rows import dict_row
from pydantic import BaseModel, Field, field_validator, model_validator

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/previsoes", tags=["Previsoes"], dependencies=[Depends(exigir_acesso)])

PERIODO = r"^[0-9]{4}-(0[1-9]|1[0-2])$"
COLUNAS = "id, periodo, tipo, descricao, valor, concluida, categoria_id"


def _descricao_limpa(valor: str | None) -> str | None:
    if valor is None:
        return None
    limpo = valor.strip()
    if not limpo:
        raise ValueError("A descricao nao pode ficar vazia.")
    return limpo


class PrevisaoCreate(BaseModel):
    periodo: str = Field(pattern=PERIODO)
    tipo: Literal["ENTRADA", "SAIDA"] = "ENTRADA"
    descricao: str = Field(min_length=1, max_length=120)
    # Valor fixo OU categoria (valor automatico = total da categoria no periodo, calculado no painel)
    valor: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    categoria_id: UUID | None = None

    _limpar = field_validator("descricao")(_descricao_limpa)

    @model_validator(mode="after")
    def _valor_ou_categoria(self):
        if (self.valor is None) == (self.categoria_id is None):
            raise ValueError("Informe um valor OU uma categoria (com categoria, o valor e automatico).")
        return self


class PrevisaoUpdate(BaseModel):
    """So o que for enviado muda; nenhum campo aceita null."""
    tipo: Literal["ENTRADA", "SAIDA"] | None = None
    descricao: str | None = Field(default=None, min_length=1, max_length=120)
    valor: Decimal | None = Field(default=None, gt=0, max_digits=14, decimal_places=2)
    concluida: bool | None = None

    _limpar = field_validator("descricao")(_descricao_limpa)


def _erro_de_dados(erro: psycopg.Error) -> HTTPException:
    """Regras do banco viram mensagens claras; o resto e erro interno."""
    if isinstance(erro, erros_pg.ForeignKeyViolation):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria nao encontrada.")
    if isinstance(erro, erros_pg.CheckViolation):
        return HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Previsao ligada a categoria tem valor automatico e nao aceita valor fixo.")
    return _erro_interno(erro)


def _erro_interno(erro: Exception) -> HTTPException:
    print(f"Erro em previsoes: {erro}")
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")


@router.get("")
def listar(periodo: str = Query(pattern=PERIODO)):
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"SELECT {COLUNAS} FROM previsoes WHERE periodo = %s ORDER BY concluida, criado_em", (periodo,))
            return {"previsoes": cur.fetchall()}
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(payload: PrevisaoCreate):
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"INSERT INTO previsoes (periodo, tipo, descricao, valor, categoria_id) VALUES (%s, %s, %s, %s, %s) RETURNING {COLUNAS}",
                (payload.periodo, payload.tipo, payload.descricao, payload.valor, payload.categoria_id),
            )
            return cur.fetchone()
    except psycopg.Error as erro:
        raise _erro_de_dados(erro)


@router.patch("/{previsao_id}")
def atualizar(previsao_id: UUID, payload: PrevisaoUpdate):
    enviados = payload.model_fields_set & {"tipo", "descricao", "valor", "concluida"}
    if not enviados:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Nada para atualizar.")
    for campo in enviados:
        if getattr(payload, campo) is None:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"{campo} nao pode ser nulo.")
    campos = sorted(enviados)  # nomes de colunas vem desta lista fixa, nunca do cliente
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"UPDATE previsoes SET {', '.join(f'{c} = %s' for c in campos)}, atualizado_em = now() "
                f"WHERE id = %s RETURNING {COLUNAS}",
                [getattr(payload, c) for c in campos] + [previsao_id],
            )
            linha = cur.fetchone()
            if not linha:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Previsao nao encontrada.")
            return linha
    except psycopg.Error as erro:
        raise _erro_de_dados(erro)


@router.delete("/{previsao_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(previsao_id: UUID):
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM previsoes WHERE id = %s", (previsao_id,))
            if cur.rowcount == 0:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Previsao nao encontrada.")
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except psycopg.Error as erro:
        raise _erro_interno(erro)
