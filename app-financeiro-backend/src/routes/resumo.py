from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from psycopg.rows import dict_row
import psycopg

router = APIRouter(prefix="/api/v1/resumo", tags=["Resumo Consolidado"])

@router.get("", status_code=status.HTTP_200_OK)
def obter_resumo_mensal(
    ano: int = Query(..., description="Ano de referência"),
    mes: int = Query(..., ge=1, le=12, description="Mês de referência"),
    usuario_id: str = Depends(obter_usuario_logado)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # 1. Busca todas as Entradas do usuário
                cur.execute("""
                    SELECT valor, data_recebimento, confirmada, regra_recorrencia
                    FROM entradas WHERE usuario_id = %s;
                """, (usuario_id,))
                entradas_db = cur.fetchall()

                # 2. Busca todas as Saídas do usuário
                cur.execute("""
                    SELECT valor, data_vencimento, pago, regra_recorrencia, is_reembolsavel, forma_pagamento
                    FROM saidas WHERE usuario_id = %s;
                """, (usuario_id,))
                saidas_db = cur.fetchall()

        # --- PROCESSAMENTO DE ENTRADAS ---
        meses_fechados_entradas = {
            (e["data_recebimento"].year, e["data_recebimento"].month) 
            for e in entradas_db if e["regra_recorrencia"] == "DATA_EXATA"
        }
        
        entradas_validas = []
        for e in entradas_db:
            if e["regra_recorrencia"] == "DATA_EXATA":
                if e["data_recebimento"].year == ano and e["data_recebimento"].month == mes:
                    entradas_validas.append(e)
            else:
                if (ano, mes) not in meses_fechados_entradas:
                    entradas_validas.append(e)

        # --- PROCESSAMENTO DE SAÍDAS ---
        meses_fechados_saidas = {
            (s["data_vencimento"].year, s["data_vencimento"].month) 
            for s in saidas_db if s["regra_recorrencia"] == "DATA_EXATA"
        }
        
        saidas_validas = []
        for s in saidas_db:
            if s["regra_recorrencia"] == "DATA_EXATA":
                if s["data_vencimento"].year == ano and s["data_vencimento"].month == mes:
                    saidas_validas.append(s)
            else:
                if (ano, mes) not in meses_fechados_saidas:
                    saidas_validas.append(s)

        # --- A MATEMÁTICA DO DASHBOARD ---
        
        # 1. SALDO ATUAL: Dinheiro vivo na conta hoje
        # Entradas confirmadas MENOS Saídas pagas (Cartão de crédito pago também sai da conta)
        total_entradas_confirmadas = sum(float(e["valor"]) for e in entradas_validas if e["confirmada"])
        total_saidas_pagas = sum(float(s["valor"]) for s in saidas_validas if s["pago"])
        saldo_atual = total_entradas_confirmadas - total_saidas_pagas
        
        # 2. SALDO PROJETADO: Expectativa de fim de mês 
        # Total de Entradas MENOS Total de Saídas Pessoais (ignora o que a galera/mãe vai devolver)
        total_entradas_mes = sum(float(e["valor"]) for e in entradas_validas)
        total_saidas_pessoais = sum(float(s["valor"]) for s in saidas_validas if not s["is_reembolsavel"])
        saldo_projetado = total_entradas_mes - total_saidas_pessoais

        # 3. CARTÃO DE CRÉDITO: Fatura pendente
        # Soma tudo que é crédito e ainda não foi pago
        fatura_pendente = sum(
            float(s["valor"]) for s in saidas_validas 
            if s["forma_pagamento"] == "CREDITO" and not s["pago"]
        )

        # 4. TERCEIROS: Dinheiro que precisa voltar pro seu bolso (Mãe/Amigos)
        total_reembolsavel = sum(float(s["valor"]) for s in saidas_validas if s["is_reembolsavel"])

        return {
            "periodo": {"ano": ano, "mes": mes},
            "contas_bancarias": {
                "saldo_atual_em_conta": round(saldo_atual, 2),
                "saldo_projetado_fim_do_mes": round(saldo_projetado, 2)
            },
            "cartao_de_credito": {
                "fatura_atual_pendente": round(fatura_pendente, 2)
            },
            "terceiros": {
                "valores_a_serem_reembolsados": round(total_reembolsavel, 2)
            }
        }

    except psycopg.Error as erro:
        print(f"Erro no banco de dados: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar o resumo consolidado.")