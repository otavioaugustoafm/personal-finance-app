import os
import psycopg
from dotenv import load_dotenv

# Carrega as variáveis do arquivo .env para a memória do sistema
load_dotenv()

# Busca a URL do banco. Se não encontrar, barra a execução por segurança
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("Alerta de Infraestrutura: DATABASE_URL não encontrada no arquivo .env.")

def get_db_connection():
    """
    Abre e retorna uma conexão com o banco de dados.
    O uso do 'psycopg' v3 garante alta performance.
    """
    return psycopg.connect(DATABASE_URL)