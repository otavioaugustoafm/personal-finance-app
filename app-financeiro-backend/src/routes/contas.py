from collections import defaultdict

import psycopg
from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.rows import dict_row

from src.database import get_db_connection
from src.dependencies import exigir_acesso

router = APIRouter(prefix="/api/v1/contas", tags=["Contas"], dependencies=[Depends(exigir_acesso)])

HOJE_BRASILIA = "(now() AT TIME ZONE 'America/Sao_Paulo')::date"


@router.get("")
def listar():
    """Contas com saldo da ultima sincronizacao.

    - CORRENTE / POUPANCA: `saldo` e o disponivel.
    - CARTAO_CREDITO: `saldo` e o LIMITE UTILIZADO (inclui parcelas futuras), que NAO e a fatura.
      A fatura vem em `proximas_faturas` (vencimento >= hoje), quando o banco as informa.
    """
    try:
        with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """SELECT c.id, c.tipo, c.nome, c.saldo, c.saldo_atualizado_em, x.instituicao,
                          NULLIF(c.detalhes->>'creditLimit', '')::numeric          AS limite_total,
                          NULLIF(c.detalhes->>'availableCreditLimit', '')::numeric AS limite_disponivel
                     FROM contas c JOIN conexoes x ON x.id = c.conexao_id
                    ORDER BY c.tipo, c.nome"""
            )
            contas = cur.fetchall()
            cur.execute(
                f"""SELECT conta_id, vencimento, fechamento, total, minimo, pagamentos
                      FROM faturas WHERE vencimento >= {HOJE_BRASILIA} ORDER BY vencimento"""
            )
            por_conta = defaultdict(list)
            for f in cur.fetchall():
                por_conta[f.pop("conta_id")].append(f)
            for conta in contas:
                conta["proximas_faturas"] = por_conta[conta["id"]][:2] if conta["tipo"] == "CARTAO_CREDITO" else []
            return {"contas": contas}
    except psycopg.Error as erro:
        print(f"Erro em contas: {erro}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Erro interno no servidor.")
