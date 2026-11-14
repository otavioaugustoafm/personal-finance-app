from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from src.config import APP_PASSWORD_HASH, JWT_ALGORITHM, JWT_SECRET_KEY

# O Brasil nao tem horario de verao desde 2019, entao um offset fixo de UTC-3 basta
# e evita depender de banco de fusos horarios dentro da Lambda.
FUSO_BRASILIA = timezone(timedelta(hours=-3))


def verificar_senha(senha: str) -> bool:
    try:
        return bcrypt.checkpw(senha.encode("utf-8"), APP_PASSWORD_HASH.encode("utf-8"))
    except ValueError:
        return False


def proxima_segunda_meia_noite(agora: datetime | None = None) -> datetime:
    """Proxima segunda-feira, 00:00 (Brasilia), estritamente depois de 'agora'."""
    agora = (agora or datetime.now(FUSO_BRASILIA)).astimezone(FUSO_BRASILIA)
    dias = (7 - agora.weekday()) % 7 or 7  # segunda = 0
    alvo = agora + timedelta(days=dias)
    return alvo.replace(hour=0, minute=0, second=0, microsecond=0)


def criar_token_acesso() -> tuple[str, datetime]:
    """Token sem relacao com usuario: so prova que a senha de acesso foi informada."""
    agora = datetime.now(timezone.utc)
    expira = proxima_segunda_meia_noite()
    payload = {"sub": "acesso", "iat": agora, "exp": expira}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM), expira
