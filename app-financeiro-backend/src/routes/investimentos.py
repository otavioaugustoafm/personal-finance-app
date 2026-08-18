from fastapi import APIRouter, Depends, HTTPException, status
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from src.schemas.investimentos import InvestimentoCreate, InvestimentoUpdate
from psycopg.rows import dict_row
import psycopg

router = APIRouter(prefix="/api/v1/investimentos", tags=["Investimentos"])

def extrair_id(usuario):
    if isinstance(usuario, str):
        return usuario
    elif isinstance(usuario, dict):
        return usuario.get("id")
    return getattr(usuario, "id", str(usuario))

@router.get("", status_code=status.HTTP_200_OK)
def listar_carteira(usuario = Depends(obter_usuario_logado)):
    user_id = extrair_id(usuario)
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT 
                        c.id, 
                        a.ticker, 
                        a.categoria, 
                        c.quantidade, 
                        c.preco_medio, 
                        c.percentual_alvo, 
                        a.cotacao_atual, 
                        a.ultima_atualizacao
                    FROM carteira c
                    JOIN ativos a ON c.ativo_id = a.id
                    WHERE c.usuario_id = %s
                    ORDER BY a.ticker;
                """, (user_id,))
                return cur.fetchall()
    except psycopg.Error as e:
        print(f"Erro ao listar carteira: {e}")
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