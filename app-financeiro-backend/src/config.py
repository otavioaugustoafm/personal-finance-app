"""Configuracao central. Tudo vem de variaveis de ambiente; nada de segredo no codigo."""
import os

from dotenv import load_dotenv

load_dotenv()


def _obrigatoria(nome: str) -> str:
    valor = os.getenv(nome, "").strip()
    if not valor:
        raise RuntimeError(f"Variavel de ambiente obrigatoria ausente: {nome}")
    return valor


# Obrigatoria em tudo (API e sincronizacao)
DATABASE_URL = _obrigatoria("DATABASE_URL")

# Usadas so pela API (login). A sincronizacao nao precisa delas.
APP_PASSWORD_HASH = os.getenv("APP_PASSWORD_HASH", "").strip()
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "").strip()
JWT_ALGORITHM = "HS256"


def validar_config_api() -> None:
    """Chamada na inicializacao da API: ela nao sobe sem login configurado."""
    if not APP_PASSWORD_HASH:
        raise RuntimeError("Variavel de ambiente obrigatoria ausente: APP_PASSWORD_HASH")
    if len(JWT_SECRET_KEY) < 32:
        raise RuntimeError("JWT_SECRET_KEY deve ter pelo menos 32 caracteres.")


ALLOWED_ORIGINS = [
    o.strip().rstrip("/")
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]
