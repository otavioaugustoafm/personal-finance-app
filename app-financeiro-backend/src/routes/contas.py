import psycopg
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.rows import dict_row

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/contas", tags=["Contas"], dependencies=[Depends(exigir_acesso)])


@router.get("")
def listar():
    """Contas do Santander com o saldo da ultima sincronizacao.
    Em CORRENTE/POUPANCA o saldo e o disponivel; em CARTAO_CREDITO e o valor em aberto informado pelo banco."""
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """SELECT c.id, c.tipo, c.nome, c.saldo, c.saldo_atualizado_em, x.instituicao
                     FROM contas c JOIN conexoes x ON x.id = c.conexao_id
                    ORDER BY c.tipo, c.nome"""
            )
            return {"contas": cur.fetchall()}
    except psycopg.Error as erro:
        print(f"Erro em contas: {erro}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")
