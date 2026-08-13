from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from src.database import get_db_connection
from src.security import verificar_senha, criar_token_acesso
from psycopg.rows import dict_row
import psycopg

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticação"])

# Schemas de validação (Pydantic)
class LoginRequest(BaseModel):
    email: EmailStr
    senha: str = Field(..., min_length=1)

class UsuarioResumo(BaseModel):
    id: str
    nome: str
    email: str

class LoginResponse(BaseModel):
    token: str
    expira_em: int = 3600
    usuario: UsuarioResumo

@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
def login(payload: LoginRequest):
    """
    Autentica o usuário comparando o e-mail e validando o hash da senha,
    retornando um token JWT em caso de sucesso.
    """
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    SELECT id, nome, email, senha_hash 
                    FROM usuarios 
                    WHERE lower(email) = lower(%s);
                """, (payload.email,))
                usuario = cur.fetchone()
    except psycopg.Error as erro:
        print(f"Erro no banco: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    # Proteção contra enumeração de e-mails (retorna 401 genérico)
    if usuario is None or not verificar_senha(payload.senha, usuario["senha_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "codigo": "CREDENCIAIS_INVALIDAS",
                "mensagem": "E-mail ou senha incorretos."
            }
        )

    # Gera o Token JWT usando o ID do usuário convertido para string
    token = criar_token_acesso(usuario_id=str(usuario["id"]))

    return LoginResponse(
        token=token,
        expira_em=3600,
        usuario=UsuarioResumo(
            id=str(usuario["id"]),
            nome=usuario["nome"],
            email=usuario["email"]
        )
    )