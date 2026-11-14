import psycopg
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.rows import dict_row

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/sincronizacao", tags=["Sincronizacao"], dependencies=[Depends(exigir_acesso)])


@router.get("/status")
def situacao():
    """Ultima sincronizacao e validade da autorizacao do Meu Pluggy (expira em 1 ano)."""
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """SELECT iniciada_em, finalizada_em, status, novas, atualizadas, erro, avisos
                     FROM sincronizacoes ORDER BY iniciada_em DESC LIMIT 1"""
            )
            ultima = cur.fetchone()
            cur.execute(
                """SELECT instituicao, status, ultima_sincronizacao_em, consentimento_expira_em,
                          (consentimento_expira_em::date - CURRENT_DATE) AS dias_para_expirar
                     FROM conexoes ORDER BY criado_em"""
            )
            return {"ultima": ultima, "conexoes": cur.fetchall()}
    except psycopg.Error as erro:
        print(f"Erro em sincronizacao: {erro}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")
