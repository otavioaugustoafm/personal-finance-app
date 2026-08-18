from fastapi import APIRouter, Depends, HTTPException, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from src.schemas.investimentos import TransacaoCreate, InvestimentoUpdate
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
def registrar_transacao(transacao: TransacaoCreate, usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # 1. Busca ou cria o ativo na tabela global (A B3 do nosso sistema)
                cur.execute("SELECT id FROM ativos WHERE ticker = %s", (transacao.ticker,))
                ativo = cur.fetchone()
                
                if not ativo:
                    cur.execute(
                        "INSERT INTO ativos (ticker, categoria) VALUES (%s, %s) RETURNING id",
                        (transacao.ticker, transacao.categoria)
                    )
                    ativo_id = cur.fetchone()["id"]
                else:
                    ativo_id = ativo["id"]

                # 2. Registra a nova nota de corretagem no histórico de Transações
                cur.execute("""
                    INSERT INTO transacoes (usuario_id, ativo_id, tipo, quantidade, preco_unitario)
                    VALUES (%s, %s, %s, %s, %s)
                """, (user_id, ativo_id, transacao.tipo, transacao.quantidade, transacao.preco_unitario))

                # 3. O MOTOR DE PREÇO MÉDIO: Puxa o histórico e calcula a nova posição
                cur.execute("""
                    SELECT tipo, quantidade, preco_unitario 
                    FROM transacoes 
                    WHERE usuario_id = %s AND ativo_id = %s 
                    ORDER BY data_transacao ASC
                """, (user_id, ativo_id))
                historico = cur.fetchall()

                qtd_total = 0.0
                pm = 0.0

                for t in historico:
                    qtd = float(t["quantidade"])
                    preco = float(t["preco_unitario"])
                    
                    if t["tipo"] == "COMPRA":
                        # Fórmula de PM: (Valor total que já tinha + Valor da nova compra) / Nova Quantidade Total
                        valor_atual = qtd_total * pm
                        valor_compra = qtd * preco
                        qtd_total += qtd
                        pm = (valor_atual + valor_compra) / qtd_total if qtd_total > 0 else 0
                        
                    elif t["tipo"] == "VENDA":
                        # Venda não altera Preço Médio, apenas diminui a quantidade
                        qtd_total -= qtd
                        if qtd_total <= 0:
                            qtd_total = 0
                            pm = 0.0 # Zerou a posição

                # 4. Atualiza a "Fotografia" na tabela Carteira usando UPSERT
                if qtd_total > 0:
                    cur.execute("""
                        INSERT INTO carteira (usuario_id, ativo_id, quantidade, preco_medio, percentual_alvo)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (usuario_id, ativo_id) 
                        DO UPDATE SET 
                            quantidade = EXCLUDED.quantidade, 
                            preco_medio = EXCLUDED.preco_medio, 
                            updated_at = NOW()
                    """, (user_id, ativo_id, qtd_total, pm, transacao.percentual_alvo))
                else:
                    # Se vendeu tudo, remove da tela consolidada da carteira
                    cur.execute("DELETE FROM carteira WHERE usuario_id = %s AND ativo_id = %s", (user_id, ativo_id))

                conn.commit()
                return {"mensagem": "Transação registrada e PM recalculado com sucesso!"}
                
    except psycopg.Error as e:
        conn.rollback()
        print(f"Erro ao registrar transação: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao calcular PM.")

