import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from src.config import JWT_ALGORITHM, JWT_SECRET_KEY

_esquema = HTTPBearer(auto_error=False)


def exigir_acesso(credenciais: HTTPAuthorizationCredentials | None = Security(_esquema)) -> None:
    """Dependencia de rota: bloqueia quem nao tiver um token valido e nao expirado."""
    if credenciais is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Acesso nao autenticado.")
    try:
        jwt.decode(credenciais.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Sessao expirada. Entre novamente.")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Token invalido.")
