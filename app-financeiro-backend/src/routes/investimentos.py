from fastapi import APIRouter, Depends, HTTPException, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from src.schemas.investimentos import InvestimentoCreate, InvestimentoUpdate
from psycopg.rows import dict_row
import psycopg
import requests
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/v1/investimentos", tags=["Investimentos"])

def extrair_id(usuario):
    if isinstance(usuario, str):
        return usuario
    elif isinstance(usuario, dict):
        return usuario.get("id")
    return getattr(usuario, "id", str(usuario))

BRAPI_TOKEN = "mHttSuyMJ771Z1iSmh8T2M" # Cole o token da Brapi aqui

def atualizar_cotacoes_ativos(ativos, conn):
    agora = datetime.now(timezone.utc)
    tickers_para_buscar = []
    
    # 1. Verifica quem precisa atualizar (Cache de 30 min)
    for ativo in ativos:
        ultima_att = ativo["ultima_atualizacao"]
        if not ultima_att or (agora - ultima_att) > timedelta(minutes=30):
            tickers_para_buscar.append(ativo["ticker"])
            
    if not tickers_para_buscar:
        return # Todos os ativos estão no cache, não faz nada!
        
    # 2. Busca todos os tickers atrasados de uma única vez na Brapi
    try:
        tickers_str = ",".join(tickers_para_buscar)
        url = f"https://brapi.dev/api/quote/{tickers_str}?token={BRAPI_TOKEN}"
        
        resposta = requests.get(url, timeout=10)
        dados = resposta.json()
        
        if "results" in dados:
            with conn.cursor() as cur:
                for resultado in dados["results"]:
                    ticker = resultado.get("symbol")
                    preco = resultado.get("regularMarketPrice")
                    
                    if preco:
                        # 3. Salva no banco e renova o prazo de validade do cache
                        cur.execute("""
                            UPDATE ativos 
                            SET cotacao_atual = %s, ultima_atualizacao = NOW() 
                            WHERE ticker = %s
                        """, (preco, ticker))
                conn.commit()
    except Exception as e:
        print(f"Erro na integração com Brapi: {e}")

@router.get("", status_code=status.HTTP_200_OK)
def listar_carteira(usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            # Pega todos os ativos únicos que o usuário tem
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT DISTINCT a.id, a.ticker, a.cotacao_atual, a.ultima_atualizacao 
                    FROM ativos a
                    JOIN carteira c ON a.id = c.ativo_id
                    WHERE c.usuario_id = %s
                """, (user_id,))
                ativos_do_usuario = cur.fetchall()
                
            # Dispara o Motor de Cotações (só vai usar a API se o cache venceu)
            if ativos_do_usuario:
                atualizar_cotacoes_ativos(ativos_do_usuario, conn)
                
            # Agora busca a carteira final com os preços fresquinhos
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT 
                        c.id as carteira_id, 
                        a.ticker, 
                        a.categoria, 
                        c.quantidade, 
                        c.preco_medio, 
                        c.percentual_alvo, 
                        a.cotacao_atual
                    FROM carteira c
                    JOIN ativos a ON c.ativo_id = a.id
                    WHERE c.usuario_id = %s
                    ORDER BY a.ticker;
                """, (user_id,))
                carteira_raw = cur.fetchall()
                
        # 4. A Matemática de Portfólio
        carteira_processada = []
        patrimonio_total = 0.0
        
        for item in carteira_raw:
            qtd = float(item["quantidade"])
            pm = float(item["preco_medio"])
            # Se a API falhar no dia, ele usa o preço médio para não quebrar a tela
            cotacao = float(item["cotacao_atual"] or pm) 
            
            valor_investido = qtd * pm
            saldo_atual = qtd * cotacao
            lucro_prejuizo = saldo_atual - valor_investido
            rentabilidade_perc = ((cotacao / pm) - 1) * 100 if pm > 0 else 0
            
            patrimonio_total += saldo_atual
            
            carteira_processada.append({
                **item,
                "valor_investido": round(valor_investido, 2),
                "saldo_atual": round(saldo_atual, 2),
                "lucro_prejuizo": round(lucro_prejuizo, 2),
                "rentabilidade_percentual": round(rentabilidade_perc, 2)
            })
            
        # Calcula o "Peso na Carteira" (Quantos % esse ativo representa do total)
        for item in carteira_processada:
            item["peso_atual_percentual"] = round((item["saldo_atual"] / patrimonio_total * 100), 2) if patrimonio_total > 0 else 0

        return {
            "patrimonio_total": round(patrimonio_total, 2),
            "ativos": carteira_processada
        }
    except Exception as e:
        print(f"Erro ao carregar investimentos: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor")

@router.post("", status_code=status.HTTP_201_CREATED)
def adicionar_ativo(investimento: InvestimentoCreate, usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # 1. Verifica se o ativo já existe na tabela global
                cur.execute("SELECT id FROM ativos WHERE ticker = %s", (investimento.ticker,))
                ativo = cur.fetchone()
                
                # Se não existir, insere na tabela global
                if not ativo:
                    cur.execute(
                        "INSERT INTO ativos (ticker, categoria) VALUES (%s, %s) RETURNING id",
                        (investimento.ticker, investimento.categoria)
                    )
                    ativo_id = cur.fetchone()["id"]
                else:
                    ativo_id = ativo["id"]

                # 2. Verifica se o usuário já tem esse ativo na carteira
                cur.execute("SELECT id FROM carteira WHERE usuario_id = %s AND ativo_id = %s", (user_id, ativo_id))
                if cur.fetchone():
                    raise HTTPException(status_code=400, detail=f"O ativo {investimento.ticker} já está na sua carteira.")

                # 3. Insere a posição do usuário na carteira
                cur.execute("""
                    INSERT INTO carteira (usuario_id, ativo_id, quantidade, preco_medio, percentual_alvo)
                    VALUES (%s, %s, %s, %s, %s) RETURNING id
                """, (user_id, ativo_id, investimento.quantidade, investimento.preco_medio, investimento.percentual_alvo))
                
                novo_id = cur.fetchone()["id"]
                conn.commit()
                return {"mensagem": "Ativo adicionado com sucesso!", "id": novo_id}
                
    except HTTPException:
        raise
    except psycopg.Error as e:
        conn.rollback()
        print(f"Erro ao adicionar ativo: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar ativo")

@router.put("/{carteira_id}", status_code=status.HTTP_200_OK)
def atualizar_ativo(carteira_id: str, investimento: InvestimentoUpdate, usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # Busca a posição atual para manter os dados que não foram enviados na edição
                cur.execute("SELECT quantidade, preco_medio, percentual_alvo FROM carteira WHERE id = %s AND usuario_id = %s", (carteira_id, user_id))
                posicao = cur.fetchone()
                
                if not posicao:
                    raise HTTPException(status_code=404, detail="Posição não encontrada.")

                nova_qtd = investimento.quantidade if investimento.quantidade is not None else posicao["quantidade"]
                novo_preco = investimento.preco_medio if investimento.preco_medio is not None else posicao["preco_medio"]
                novo_alvo = investimento.percentual_alvo if investimento.percentual_alvo is not None else posicao["percentual_alvo"]

                cur.execute("""
                    UPDATE carteira 
                    SET quantidade = %s, preco_medio = %s, percentual_alvo = %s, updated_at = NOW()
                    WHERE id = %s AND usuario_id = %s
                """, (nova_qtd, novo_preco, novo_alvo, carteira_id, user_id))
                
                conn.commit()
                return {"mensagem": "Posição atualizada com sucesso!"}
    except HTTPException:
        raise
    except psycopg.Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erro ao atualizar ativo.")

@router.delete("/{carteira_id}", status_code=status.HTTP_200_OK)
def remover_ativo(carteira_id: str, usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM carteira WHERE id = %s AND usuario_id = %s", (carteira_id, user_id))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Posição não encontrada.")
                conn.commit()
                return {"mensagem": "Ativo removido da carteira."}
    except HTTPException:
        raise
    except psycopg.Error as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail="Erro ao remover ativo.")