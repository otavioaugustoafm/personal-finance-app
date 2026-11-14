from uuid import UUID

import psycopg
from fastapi import APIRouter, Depends, HTTPException, Response, status
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(
    prefix="/api/v1/categorias",
    tags=["Categorias"],
    dependencies=[Depends(exigir_acesso)],
)

COLUNAS = "id, nome, tipo, cor"


class CategoriaCreate(BaseModel):
    nome: str = Field(..., min_length=1, max_length=60)
    tipo: str = Field(default="SAIDA", pattern="^(ENTRADA|SAIDA)$")
    cor: str | None = Field(default=None, pattern="^#[0-9a-fA-F]{6}$")


class CategoriaUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=1, max_length=60)
    cor: str | None = Field(default=None, pattern="^#[0-9a-fA-F]{6}$")


def _erro_interno(erro: Exception) -> HTTPException:
    print(f"Erro em categorias: {erro}")
    return HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")


@router.get("")
def listar():
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(f"SELECT {COLUNAS} FROM categorias WHERE NOT arquivada ORDER BY nome")
            return {"categorias": cur.fetchall()}
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.post("", status_code=status.HTTP_201_CREATED)
def criar(payload: CategoriaCreate):
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"INSERT INTO categorias (nome, tipo, cor) VALUES (%s, %s, %s) RETURNING {COLUNAS}",
                (payload.nome.strip(), payload.tipo, payload.cor),
            )
            return cur.fetchone()
    except UniqueViolation:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ja existe uma categoria com esse nome e tipo.")
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.put("/{categoria_id}")
def atualizar(categoria_id: UUID, payload: CategoriaUpdate):
    if payload.nome is None and payload.cor is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Nada para atualizar.")
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                f"""UPDATE categorias
                       SET nome = COALESCE(%s, nome), cor = COALESCE(%s, cor)
                     WHERE id = %s
                 RETURNING {COLUNAS}""",
                (payload.nome.strip() if payload.nome else None, payload.cor, categoria_id),
            )
            categoria = cur.fetchone()
            if not categoria:
                raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Categoria nao encontrada.")
            return categoria
    except UniqueViolation:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ja existe uma categoria com esse nome e tipo.")
    except psycopg.Error as erro:
        raise _erro_interno(erro)


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def excluir(categoria_id: UUID):
    """Transacoes da categoria excluida ficam sem categoria (ON DELETE SET NULL)."""
    try:
        with get_db_connection() as conn, conn.cursor() as cur:
            cur.execute("DELETE FROM categorias WHERE id = %s", (categoria_id,))
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except psycopg.Error as erro:
        raise _erro_interno(erro)
