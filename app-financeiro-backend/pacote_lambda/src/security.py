from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "chave_padrao_insegura")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 3600  # 1 hora

def verificar_senha(senha_texto_plano: str, senha_hash: str) -> bool:
    """Compara a senha enviada com o hash do banco usando bcrypt."""
    senha_bytes = senha_texto_plano.encode("utf-8")
    hash_bytes = senha_hash.encode("utf-8")
    try:
        return bcrypt.checkpw(senha_bytes, hash_bytes)
    except ValueError:
        return False

def criar_token_acesso(usuario_id: str) -> str:
    """Gera um token JWT assinado contendo o ID do usuário (sub)."""
    agora = datetime.now(timezone.utc)
    expiracao = agora + timedelta(seconds=JWT_EXPIRATION_SECONDS)
    payload = {
        "sub": usuario_id,
        "iat": agora,
        "exp": expiracao,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)