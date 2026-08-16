import calendar
from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from psycopg.rows import dict_row
import psycopg
from src.schemas.saidas import SaidaCreate, SaidaUpdate

router = APIRouter(prefix="/api/v1/saidas", tags=["Saídas"])

# ROTA CORRIGIDA PARA POST E /pagar-fatura
@router.post("/pagar-fatura", status_code=status.HTTP_200_OK)
def pagar_fatura_mes(
    ano: int = Query(...), 
    mes: int = Query(...), 
    usuario_id = Depends(obter_usuario_logado)
):
    user_id = extrair_id(usuario_id)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE saidas 
                    SET pago = true 
                    WHERE usuario_id = %s 
                      AND UPPER(forma_pagamento) = 'CREDITO' 
                      AND pago = false 
                      AND EXTRACT(YEAR FROM data_vencimento::date) = %s 
                      AND EXTRACT(MONTH FROM data_vencimento::date) = %s;
                """, (user_id, ano, mes))
                linhas_afetadas = cur.rowcount
                conn.commit()
                
                print(f"🎯 SUCESSO: A fatura do mês {mes}/{ano} foi paga! {linhas_afetadas} gastos atualizados.")
        
        return {"mensagem": f"Fatura paga! {linhas_afetadas} despesas marcadas como pagas."}
    except psycopg.Error as erro:
        print(f"Erro no banco ao pagar fatura: {erro}")
        raise HTTPException(status_code=500, detail="Erro ao pagar fatura.")

def calcular_ultimo_dia_util(ano: int, mes: int) -> date:
    if mes == 12:
        proximo_mes = date(ano + 1, 1, 1)
    else:
        proximo_mes = date(ano, mes + 1, 1)
    ultimo_dia = proximo_mes - timedelta(days=1)
    if ultimo_dia.weekday() == 5:
        ultimo_dia -= timedelta(days=1)
    elif ultimo_dia.weekday() == 6:
        ultimo_dia -= timedelta(days=2)
    return ultimo_dia

def adicionar_meses(data_base: date, meses: int) -> date:
    mes = data_base.month - 1 + meses
    ano = data_base.year + mes // 12
    mes = mes % 12 + 1
    dia = min(data_base.day, calendar.monthrange(ano, mes)[1])
    return date(ano, mes, dia)

def extrair_id(usuario):
    if isinstance(usuario, str):
        return usuario
    elif isinstance(usuario, dict):
        return usuario.get("id")
    return getattr(usuario, "id", str(usuario))

@router.get("", status_code=status.HTTP_200_OK)
def listar_saidas(
    ano: int = Query(..., description="Ano de referência (ex: 2026)"),
    mes: int = Query(..., ge=1, le=12, description="Mês de referência (1–12)"),
    usuario_id = Depends(obter_usuario_logado)
):
    try:
        user_id = extrair_id(usuario_id)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT id, descricao, valor, tipo_saida, data_vencimento, pago, regra_recorrencia,
                           is_reembolsavel, forma_pagamento, categoria
                    FROM saidas
                    WHERE usuario_id = %s;
                """, (user_id,))
                registros = cur.fetchall()

        saidas_processadas = []
        for e in registros:
            tipo = e["tipo_saida"]
            regra = e["regra_recorrencia"]
            data_original = e["data_vencimento"]
            
            if regra == "DATA_EXATA":
                if data_original.year == ano and data_original.month == mes:
                    data_calculada = data_original
                else:
                    continue
            else:
                if regra == "ULTIMO_DIA_UTIL":
                    data_calculada = calcular_ultimo_dia_util(ano, mes)
                elif regra == "DIA_FIXO":
                    dia_alvo = data_original.day
                    try:
                        data_calculada = date(ano, mes, dia_alvo)
                    except ValueError:
                        data_calculada = (date(ano, mes + 1, 1) - timedelta(days=1)) if mes < 12 else date(ano, 12, 31)
                else:
                    continue
            
            saidas_processadas.append({
                "id": str(e["id"]),
                "descricao": e["descricao"],
                "valor": float(e["valor"]),
                "tipo_saida": e["tipo_saida"],
                "regra_recorrencia": regra,
                "data_vencimento": str(data_calculada),
                "pago": e["pago"],
                "is_reembolsavel": e["is_reembolsavel"],
                "forma_pagamento": e["forma_pagamento"],
                "categoria": e["categoria"]
            })

        saidas_processadas.sort(key=lambda x: x["data_vencimento"])

        total_receitas_recebidas = sum(e["valor"] for e in saidas_processadas if e["pago"] and e["tipo_saida"] == "ENTRADA")
        total_receitas_pendentes = sum(e["valor"] for e in saidas_processadas if not e["pago"] and e["tipo_saida"] == "ENTRADA")
        
        total_despesas_pagas = sum(e["valor"] for e in saidas_processadas if e["pago"] and e["tipo_saida"] != "ENTRADA")
        total_despesas_pendentes = sum(e["valor"] for e in saidas_processadas if not e["pago"] and e["tipo_saida"] != "ENTRADA")

        saldo_atual = total_receitas_recebidas - total_despesas_pagas
        saldo_projetado = (total_receitas_recebidas + total_receitas_pendentes) - (total_despesas_pagas + total_despesas_pendentes)

        return {
            "periodo": {"ano": ano, "mes": mes},
            "saldo_atual": saldo_atual,
            "saldo_projetado": saldo_projetado,
            "total_pago": total_despesas_pagas,
            "total_pendente": total_despesas_pendentes,
            "a_receber": total_receitas_pendentes,
            "saidas": saidas_processadas
        }

    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao buscar saídas.")

@router.get("/grafico/categorias", status_code=status.HTTP_200_OK)
def listar_gastos_por_categoria(
    ano: int = Query(None, description="Ano para filtrar"), 
    mes: int = Query(None, description="Mês numérico para filtrar"),
    usuario_id = Depends(obter_usuario_logado)
):
    try:
        user_id = extrair_id(usuario_id)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                query = "SELECT categoria, SUM(valor) as total FROM saidas WHERE usuario_id = %s AND tipo_saida != 'ENTRADA'"
                params = [user_id]

                if ano:
                    query += " AND EXTRACT(YEAR FROM data_vencimento) = %s"
                    params.append(ano)
                if mes:
                    query += " AND EXTRACT(MONTH FROM data_vencimento) = %s"
                    params.append(mes)

                query += " GROUP BY categoria ORDER BY total DESC"
                cur.execute(query, tuple(params))
                resultado = cur.fetchall()

                return [{"categoria": r["categoria"], "total": float(r["total"])} for r in resultado]

    except psycopg.Error as erro:
        print(f"Erro no banco ao agrupar categorias: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao gerar gráfico de categorias.")

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_saida(saidinha: SaidaCreate, usuario_atual = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario_atual)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                parcelas = getattr(saidinha, 'quantidade_parcelas', 1) or 1
                
                if parcelas > 1:
                    saidas_criadas = []
                    for i in range(1, parcelas + 1):
                        data_vencimento = adicionar_meses(saidinha.data_vencimento, i - 1)
                        descricao_parcelada = f"{saidinha.descricao} ({i}/{parcelas})"
                        pago_atual = saidinha.pago if i == 1 else False 

                        cur.execute("""
                            INSERT INTO saidas (
                                usuario_id, descricao, valor, tipo_saida, 
                                data_vencimento, regra_recorrencia, pago,
                                is_reembolsavel, forma_pagamento, categoria
                            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            RETURNING id;
                        """, (
                            user_id, descricao_parcelada, saidinha.valor, 
                            saidinha.tipo_saida, data_vencimento, 
                            saidinha.regra_recorrencia, pago_atual,
                            saidinha.is_reembolsavel, saidinha.forma_pagamento, saidinha.categoria
                        ))
                        saidas_criadas.append(cur.fetchone()[0])
                    
                    conn.commit()
                    return {"mensagem": f"{parcelas} parcelas criadas", "ids": [str(i) for i in saidas_criadas]}
                else:
                    cur.execute("""
                        INSERT INTO saidas (
                            usuario_id, descricao, valor, tipo_saida, 
                            data_vencimento, regra_recorrencia, pago,
                            is_reembolsavel, forma_pagamento, categoria
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id;
                    """, (
                        user_id, saidinha.descricao, saidinha.valor, 
                        saidinha.tipo_saida, saidinha.data_vencimento, 
                        saidinha.regra_recorrencia, saidinha.pago,
                        saidinha.is_reembolsavel, saidinha.forma_pagamento, saidinha.categoria
                    ))
                    novo_id = cur.fetchone()[0]
                    conn.commit()
            return {"mensagem": "Saída criada com sucesso", "id": str(novo_id)}
            
    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao gravar saída.")

@router.delete("/{saida_id}", status_code=status.HTTP_200_OK)
def deletar_saida(saida_id: str, usuario_id = Depends(obter_usuario_logado)):
    try:
        user_id = extrair_id(usuario_id)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM saidas WHERE id = %s AND usuario_id = %s RETURNING id;", (saida_id, user_id))
                removido = cur.fetchone()
                conn.commit()
        if not removido:
            raise HTTPException(status_code=404, detail="Saída não encontrada.")
        return {"mensagem": "Saída deletada com sucesso"}
    except psycopg.Error as erro:
        raise HTTPException(status_code=500, detail="Falha ao excluir saída.")

@router.put("/{saida_id}", status_code=status.HTTP_200_OK)
def editar_saida(saida_id: str, saida: SaidaUpdate, usuario_id = Depends(obter_usuario_logado)):
    dados = {k: v for k, v in saida.model_dump().items() if v is not None}
    if not dados:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido.")
    campos = ", ".join([f"{k} = %s" for k in dados.keys()])
    valores = list(dados.values())
    user_id = extrair_id(usuario_id)
    valores.extend([saida_id, user_id])

    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE saidas SET {campos} WHERE id = %s AND usuario_id = %s RETURNING id;", tuple(valores))
                atualizado = cur.fetchone()
                conn.commit()
        if not atualizado:
            raise HTTPException(status_code=404, detail="Saída não encontrada.")
        return {"mensagem": "Saída atualizada com sucesso"}
    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao atualizar saída.")