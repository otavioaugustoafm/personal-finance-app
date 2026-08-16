from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from src.database import get_db_connection
import psycopg
from psycopg.errors import UniqueViolation
from psycopg.rows import dict_row
import bcrypt

router = APIRouter(prefix="/api/v1/usuarios", tags=["Usuários"])

# Filtro de entrada (Request Payload)
class UsuarioCreate(BaseModel):
    nome: str = Field(..., min_length=2, description="Nome do usuário")
    email: str = Field(..., pattern=r"^\S+@\S+\.\S+$", description="E-mail válido")
    senha: str = Field(..., min_length=8, description="A senha deve ter no mínimo 8 caracteres")

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_usuario(usuario: UsuarioCreate):
    """
    Cria uma nova conta de usuário. 
    A senha recebida é criptografada diretamente com bcrypt antes de ir para o banco.
    """
    # 1. Criptografa a senha usando bcrypt nativo
    salt = bcrypt.gensalt()
    senha_bytes = usuario.senha.encode('utf-8')
    senha_hash_bytes = bcrypt.hashpw(senha_bytes, salt)
    senha_hash = senha_hash_bytes.decode('utf-8')
    
    # 2. Tenta inserir no banco de dados
    try:
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute("""
                    INSERT INTO usuarios (nome, email, senha_hash)
                    VALUES (%s, %s, %s)
                    RETURNING id, nome, email, data_criacao;
                """, (usuario.nome, usuario.email, senha_hash))
                
                novo_usuario = cur.fetchone()
                
            conn.commit()
            
        return novo_usuario
        
    except UniqueViolation:
        raise HTTPException(status_code=409, detail="Este e-mail já está em uso.")
    except psycopg.Error as erro:
        print(f"Falha técnica no banco: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao criar usuário.")