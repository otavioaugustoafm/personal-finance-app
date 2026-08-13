from fastapi import APIRouter, HTTPException
from src.database import get_db_connection
import psycopg
# Importa o formatador de linhas como dicionário (facilita o JSON)
from psycopg.rows import dict_row 

# Cria o roteador seguindo o nosso Contrato de API
router = APIRouter(prefix="/api/v1/categorias", tags=["Categorias"])

@router.get("")
def listar_categorias():
    """
    Retorna a lista de categorias disponíveis no banco de dados.
    """
    try:
        with get_db_connection() as conn:
            # row_factory=dict_row faz o psycopg retornar {"id": 1, "nome": "x"} em vez de tuplas
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("SELECT id, nome FROM categorias ORDER BY nome;")
                lista_categorias = cur.fetchall()
        
        return {"categorias": lista_categorias}
        
    except psycopg.Error as erro:
        print(f"Falha técnica: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao buscar categorias.")