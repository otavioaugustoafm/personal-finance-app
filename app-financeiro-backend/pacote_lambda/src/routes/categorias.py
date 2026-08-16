from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, Field
from src.database import get_db_connection
from src.dependencies import obter_usuario_logado
from psycopg.rows import dict_row
import psycopg

router = APIRouter(prefix="/api/v1/categorias", tags=["Categorias"])

# ADICIONADO O CAMPO 'TIPO' (ENTRADA ou SAIDA)
class CategoriaCreate(BaseModel):
    nome: str = Field(..., min_length=1)
    tipo: str = Field(default="SAIDA")

class CategoriaUpdate(BaseModel):
    nome: str = Field(..., min_length=1)

def extrair_id(usuario):
    if isinstance(usuario, str):
        return usuario
    elif isinstance(usuario, dict):
        return usuario.get("id")
    return getattr(usuario, "id", str(usuario))

@router.get("", status_code=status.HTTP_200_OK)
def listar_categorias(usuario_atual = Depends(obter_usuario_logado)):
    try:
        usuario_id = extrair_id(usuario_atual)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # AGORA BUSCAMOS O 'TIPO' TAMBÉM
                cur.execute(
                    "SELECT id, nome, tipo FROM categorias WHERE usuario_id = %s ORDER BY nome ASC;",
                    (usuario_id,)
                )
                return {"categorias": cur.fetchall()}
    except psycopg.Error as erro:
        print(f"Erro ao buscar categorias: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

@router.post("", status_code=status.HTTP_201_CREATED)
def criar_categoria(payload: CategoriaCreate, usuario_atual = Depends(obter_usuario_logado)):
    try:
        usuario_id = extrair_id(usuario_atual)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                # AGORA INSERIMOS O 'TIPO'
                cur.execute(
                    "INSERT INTO categorias (nome, usuario_id, tipo) VALUES (%s, %s, %s) RETURNING id, nome, tipo;",
                    (payload.nome, usuario_id, payload.tipo)
                )
                nova = cur.fetchone()
                conn.commit()
                return nova
    except psycopg.Error as erro:
        print(f"Erro ao criar categoria: {erro}")
        raise HTTPException(status_code=400, detail="Erro ao criar categoria.")

@router.put("/{categoria_id}", status_code=status.HTTP_200_OK)
def atualizar_categoria(categoria_id: str, payload: CategoriaUpdate, usuario_atual = Depends(obter_usuario_logado)):
    try:
        usuario_id = extrair_id(usuario_atual)
        with get_db_connection() as conn:
            with conn.cursor(row_factory=dict_row) as cur:
                cur.execute(
                    "UPDATE categorias SET nome = %s WHERE id = %s AND usuario_id = %s RETURNING id, nome, tipo;",
                    (payload.nome, categoria_id, usuario_id)
                )
                categoria_atualizada = cur.fetchone()
                if not categoria_atualizada:
                    raise HTTPException(status_code=404, detail="Categoria não encontrada ou não pertence ao usuário.")
                conn.commit()
                return categoria_atualizada
    except psycopg.Error as erro:
        print(f"Erro ao atualizar categoria: {erro}")
        raise HTTPException(status_code=400, detail="Erro ao atualizar categoria.")

@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_categoria(categoria_id: str, usuario_atual = Depends(obter_usuario_logado)):
    try:
        usuario_id = extrair_id(usuario_atual)
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM categorias WHERE id = %s AND usuario_id = %s;",
                    (categoria_id, usuario_id)
                )
                conn.commit()
    except psycopg.Error as erro:
        print(f"Erro ao deletar categoria: {erro}")
        raise HTTPException(status_code=400, detail="Erro ao excluir categoria.")