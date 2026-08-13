from fastapi import HTTPException, status, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
import os
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "chave_padrao_insegura")
JWT_ALGORITHM = "HS256"

security_scheme = HTTPBearer()

def obter_usuario_logado(credentials: HTTPAuthorizationCredentials = Security(security_scheme)) -> str:
    """
    Valida automaticamente o token JWT enviado via header Authorization: Bearer <token>
    através do esquema oficial do FastAPI.
    """
    token = credentials.credentials

    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        usuario_id: str = payload.get("sub")
        if usuario_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"codigo": "TOKEN_INVALIDO", "mensagem": "Token não contém o identificador do usuário."}
            )
        return usuario_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"codigo": "TOKEN_EXPIRADO", "mensagem": "O token JWT expirou. Faça login novamente."}
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"codigo": "TOKEN_INVALIDO", "mensagem": "Token JWT inválido ou corrompido."}
        )