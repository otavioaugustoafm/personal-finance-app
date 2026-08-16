from fastapi import FastAPI, HTTPException
from mangum import Mangum
from src.database import get_db_connection
import psycopg
from fastapi.middleware.cors import CORSMiddleware

# Importando o módulo de rotas que acabamos de criar
from src.routes import categorias
from src.routes import usuarios  
from src.routes import auth
from src.routes import entradas
from src.routes import saidas
from src.routes import resumo


app = FastAPI(title="API Financeira Serverless")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Permite o React (localhost:5173) falar com a API
    allow_credentials=True,
    allow_methods=["*"], # Permite POST, GET, OPTIONS, DELETE, PUT
    allow_headers=["*"],
)

# Acoplando as rotas de categorias na aplicação principal
app.include_router(categorias.router)
app.include_router(usuarios.router)
app.include_router(auth.router)
app.include_router(entradas.router)
app.include_router(saidas.router)
app.include_router(resumo.router)

@app.get("/")
def health_check():
    return {"status": "ok", "mensagem": "API rodando e protegida!"}

@app.get("/api/v1/testar-banco")
def testar_conexao():
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT now();")
                tempo_banco = cur.fetchone()[0]
                
        return {
            "status": "sucesso", 
            "mensagem": "Comunicação com o Neon estabelecida!",
            "horario_do_servidor": tempo_banco
        }
    except psycopg.Error as erro:
        print(f"Falha técnica: {erro}")
        raise HTTPException(status_code=500, detail="Erro interno ao conectar no banco de dados.")

handler = Mangum(app)