import calendar
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from psycopg.rows import dict_row
import psycopg

router = APIRouter(prefix="/api/v1/resumo", tags=["Resumo"])

def extrair_id(usuario):
    if isinstance(usuario, str):
        return usuario
    elif isinstance(usuario, dict):
        return usuario.get("id")
    return getattr(usuario, "id", str(usuario))

@router.get("", status_code=status.HTTP_200_OK)
def obter_resumo(
    ano: int = Query(..., description="Ano"),
    mes: int = Query(..., description="Mês"),
    usuario_id = Depends(obter_usuario_logado)
):
    try:
        user_id = extrair_id(usuario_id)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # ADICIONADO A FORMA_PAGAMENTO NA QUERY
                cur.execute("""
                    SELECT valor, tipo_saida, pago, is_reembolsavel, data_vencimento, regra_recorrencia, forma_pagamento
                    FROM saidas
                    WHERE usuario_id = %s;
                """, (user_id,))
                registros = cur.fetchall()

        saldo_atual_mes = 0.0
        saldo_projetado_mes = 0.0
        fatura_pendente_mes = 0.0
        a_reembolsar_mes = 0.0

        for t in registros:
            val = float(t["valor"])
            is_entrada = (t["tipo_saida"] == "ENTRADA")
            pago = t["pago"]
            forma_pgto = t.get("forma_pagamento", "")
            data_original = t["data_vencimento"]
            regra = t["regra_recorrencia"]
            
            pertence_ao_mes = False
            
            if regra == "DATA_EXATA":
                if data_original.year == ano and data_original.month == mes:
                    pertence_ao_mes = True
            else:
                ultimo_dia_mes = date(ano, mes, calendar.monthrange(ano, mes)[1])
                if data_original <= ultimo_dia_mes:
                    pertence_ao_mes = True
            
            if pertence_ao_mes:
                if not is_entrada and t["is_reembolsavel"]:
                    a_reembolsar_mes += val

                if is_entrada:
                    if pago:
                        saldo_atual_mes += val 
                    saldo_projetado_mes += val 
                else:
                    if pago:
                        saldo_atual_mes -= val 
                    else:
                        # LÓGICA RESTAURADA: Só vai para a fatura se for CRÉDITO
                        if forma_pgto == "CREDITO":
                            fatura_pendente_mes += val 
                        
                    saldo_projetado_mes -= val 

        return {
            "contas_bancarias": {
                "saldo_atual_em_conta": saldo_atual_mes,
                "saldo_projetado_fim_do_mes": saldo_projetado_mes
            },
            "cartao_de_credito": {
                "fatura_atual_pendente": fatura_pendente_mes
            },
            "terceiros": {
                "valores_a_serem_reembolsados": a_reembolsar_mes
            }
        }
    except psycopg.Error as erro:
        print(f"Erro no banco ao gerar resumo: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar resumo")