import psycopg

from src.config import DATABASE_URL


def get_db_connection() -> psycopg.Connection:
    """Abre uma conexao com o Neon. Use como context manager (with ... as conn).

    prepare_threshold=None desliga os "prepared statements" automaticos do psycopg: o endereco "pooled" do Neon
    (PgBouncer) pode trocar a conexao real entre comandos, e statements preparados quebrariam de forma intermitente.
    """
    return psycopg.connect(DATABASE_URL, prepare_threshold=None, connect_timeout=15)
