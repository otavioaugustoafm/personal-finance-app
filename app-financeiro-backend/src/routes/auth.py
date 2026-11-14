from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from src.security import criar_token_acesso, verificar_senha

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])


class LoginPayload(BaseModel):
    senha: str = Field(..., min_length=1, max_length=200)


@router.post("/login")
def login(payload: LoginPayload):
    if not verificar_senha(payload.senha):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Senha incorreta.")
    token, expira = criar_token_acesso()
    return {"token": token, "expira_em": expira.isoformat()}
