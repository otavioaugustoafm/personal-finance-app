"""Testes: `pip install -r requirements-dev.txt` e `pytest`.

Os testes de banco (test_sync_db.py) APAGAM TODAS AS TABELAS do banco indicado em TEST_DATABASE_URL.
Aponte para uma branch descartavel do Neon, nunca para o banco real. Sem a variavel, eles sao pulados.
"""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from dotenv import dotenv_values

TEST_DB = os.getenv("TEST_DATABASE_URL", "")
_real = dotenv_values(Path(__file__).resolve().parent.parent / ".env").get("DATABASE_URL") or os.getenv("DATABASE_URL")
if TEST_DB and TEST_DB == _real:
    pytest.exit("TEST_DATABASE_URL e igual ao DATABASE_URL real: os testes apagariam seu banco. Use uma branch descartavel.", 2)
if TEST_DB:
    os.environ["DATABASE_URL"] = TEST_DB  # tem de ser antes de importar src.*
else:
    os.environ.setdefault("DATABASE_URL", "postgresql://nao-usado/nao-usado")

# Login de teste (senha: senha-de-teste-123). Definido antes de qualquer import de src.*
import bcrypt  # noqa: E402

os.environ["JWT_SECRET_KEY"] = "chave-so-para-testes-" + "x" * 30
os.environ["APP_PASSWORD_HASH"] = bcrypt.hashpw(b"senha-de-teste-123", bcrypt.gensalt(4)).decode()


# ---------- fixtures de banco (so ativas quando TEST_DATABASE_URL esta definida) ----------
MIGRACOES = Path(__file__).resolve().parent.parent / "migrations"


@pytest.fixture(scope="session", autouse=True)
def esquema():
    if not TEST_DB:
        return
    import psycopg

    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")  # banco de teste: recria do zero
        for arq in ("001_schema_open_finance.sql", "002_ajustes_sincronizacao.sql"):
            conn.execute((MIGRACOES / arq).read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def limpar():
    if not TEST_DB:
        return
    import psycopg

    with psycopg.connect(TEST_DB, autocommit=True) as conn:
        conn.execute("TRUNCATE conexoes, categorias, sincronizacoes CASCADE")
