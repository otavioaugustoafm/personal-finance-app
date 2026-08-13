from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from psycopg.rows import dict_row
import psycopg
from src.schemas.saidas import SaidaCreate, SaidaUpdate

router = APIRouter(prefix="/api/v1/saidas", tags=["Saídas"])

def calcular_ultimo_dia_util(ano: int, mes: int) -> date:
    """Calcula o último dia útil de um determinado mês e ano."""
    if mes == 12:
        proximo_mes = date(ano + 1, 1, 1)
    else:
        proximo_mes = date(ano, mes + 1, 1)
    
    ultimo_dia = proximo_mes - timedelta(days=1)
    
    if ultimo_dia.weekday() == 5:  # Sábado
        ultimo_dia -= timedelta(days=1)
    elif ultimo_dia.weekday() == 6:  # Domingo
        ultimo_dia -= timedelta(days=2)
        
    return ultimo_dia

@router.get("", status_code=status.HTTP_200_OK)
def listar_saidas(
    ano: int = Query(..., description="Ano de referência (ex: 2026)"),
    mes: int = Query(..., ge=1, le=12, description="Mês de referência (1–12)"),
    usuario_id: str = Depends(obter_usuario_logado)
):
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # 1. Busca os dados já incluindo as novas colunas
                cur.execute("""
                    SELECT id, descricao, valor, tipo_saida, data_vencimento, pago, regra_recorrencia,
                           is_reembolsavel, forma_pagamento
                    FROM saidas
                    WHERE usuario_id = %s;
                """, (usuario_id,))
                registros = cur.fetchall()
                
        # 2. Mapeia quais meses já têm um "snapshot" histórico (mês fechado)
        meses_fechados = {
            (e["data_vencimento"].year, e["data_vencimento"].month) 
            for e in registros if e["regra_recorrencia"] == "DATA_EXATA"
        }

        saidas_processadas = []
        
        for e in registros:
            tipo = e["tipo_saida"]
            regra = e["regra_recorrencia"]
            data_original = e["data_vencimento"]
            
            # Se for registro histórico fechado, mostra só no mês exato
            if regra == "DATA_EXATA":
                if data_original.year == ano and data_original.month == mes:
                    data_calculada = data_original
                else:
                    continue
            # Se for regra futura (Template)
            else:
                # Se o mês já foi fechado, não calcula template para não duplicar
                if (ano, mes) in meses_fechados:
                    continue 
                
                # Projeta a data baseada na regra
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
            
            # 3. Adiciona os campos novos no JSON de retorno
            saidas_processadas.append({
                "id": str(e["id"]),
                "descricao": e["descricao"],
                "valor": float(e["valor"]),
                "tipo_saida": tipo,
                "regra_recorrencia": regra,
                "data_vencimento": str(data_calculada),
                "pago": e["pago"],
                "is_reembolsavel": e["is_reembolsavel"],
                "forma_pagamento": e["forma_pagamento"]
            })

        saidas_processadas.sort(key=lambda x: x["data_vencimento"])

        total_pago = sum(e["valor"] for e in saidas_processadas if e["pago"])
        total_pendente = sum(e["valor"] for e in saidas_processadas if not e["pago"])

        return {
            "periodo": {"ano": ano, "mes": mes},
            "total_pago": total_pago,
            "total_pendente": total_pendente,
            "saidas": saidas_processadas
        }

    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao buscar saídas.")

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_saida(saidinha: SaidaCreate, usuario_id: str = Depends(obter_usuario_logado)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # Modificado para inserir os campos is_reembolsavel e forma_pagamento
                cur.execute("""
                    INSERT INTO saidas (
                        usuario_id, descricao, valor, tipo_saida, 
                        data_vencimento, regra_recorrencia, pago,
                        is_reembolsavel, forma_pagamento
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (
                    usuario_id, saidinha.descricao, saidinha.valor, 
                    saidinha.tipo_saida, saidinha.data_vencimento, 
                    saidinha.regra_recorrencia, saidinha.pago,
                    saidinha.is_reembolsavel, saidinha.forma_pagamento
                ))
                novo_id = cur.fetchone()[0]
                conn.commit()
        return {"mensagem": "Saída criada com sucesso", "id": str(novo_id)}
    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao gravar saída.")

@router.post("/fechar-mes", status_code=status.HTTP_201_CREATED)
def fechar_mes_atual_saidas(usuario_id: str = Depends(obter_usuario_logado)):
    """
    Grava o 'snapshot' de todas as saídas fixas no mês atual.
    Garante a imutabilidade do histórico mantendo o controle de reembolso e forma de pagamento.
    """
    hoje = date.today()
    ano_atual = hoje.year
    mes_atual = hoje.month
    
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                # 1. Evita fechar o mesmo mês duas vezes
                cur.execute("""
                    SELECT count(*) FROM saidas 
                    WHERE usuario_id = %s 
                    AND EXTRACT(YEAR FROM data_vencimento) = %s 
                    AND EXTRACT(MONTH FROM data_vencimento) = %s
                    AND regra_recorrencia = 'DATA_EXATA';
                """, (usuario_id, ano_atual, mes_atual))
                
                if cur.fetchone()[0] > 0:
                    raise HTTPException(status_code=400, detail="O histórico deste mês já foi gravado.")

                # 2. Cria os snapshots baseados nos Templates
                data_calculada = calcular_ultimo_dia_util(ano_atual, mes_atual)
                
                cur.execute("""
                    INSERT INTO saidas (
                        usuario_id, descricao, valor, tipo_saida, data_vencimento, 
                        regra_recorrencia, pago, is_reembolsavel, forma_pagamento
                    )
                    SELECT 
                        usuario_id, descricao, valor, 'PONTUAL', %s, 
                        'DATA_EXATA', false, is_reembolsavel, forma_pagamento
                    FROM saidas 
                    WHERE usuario_id = %s AND tipo_saida = 'FIXA';
                """, (data_calculada, usuario_id))
                
                conn.commit()
        
        return {"mensagem": f"Histórico de saídas do mês {mes_atual}/{ano_atual} fechado com sucesso."}

    except psycopg.Error as erro:
        print(f"Erro ao fechar mês: {erro}")
        raise HTTPException(status_code=500, detail="Falha ao fechar histórico do mês.")

@router.delete("/{saida_id}", status_code=status.HTTP_200_OK)
def deletar_saida(saida_id: str, usuario_id: str = Depends(obter_usuario_logado)):
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM saidas WHERE id = %s AND usuario_id = %s RETURNING id;", (saida_id, usuario_id))
                removido = cur.fetchone()
                conn.commit()
        if not removido:
            raise HTTPException(status_code=404, detail="Saída não encontrada.")
        return {"mensagem": "Saída deletada com sucesso"}
    except psycopg.Error as erro:
        raise HTTPException(status_code=500, detail="Falha ao excluir saída.")

@router.put("/{saida_id}", status_code=status.HTTP_200_OK)
def editar_saida(saida_id: str, saida: SaidaUpdate, usuario_id: str = Depends(obter_usuario_logado)):
    # O Pydantic dinâmico já lida com as colunas novas sem precisar alterar este bloco
    dados = {k: v for k, v in saida.model_dump().items() if v is not None}
    if not dados:
        raise HTTPException(status_code=400, detail="Nenhum campo fornecido.")
    
    campos = ", ".join([f"{k} = %s" for k in dados.keys()])
    valores = list(dados.values())
    valores.extend([saida_id, usuario_id])

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