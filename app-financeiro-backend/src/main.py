from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from src.config import ALLOWED_ORIGINS, validar_config_api
from src.routes import auth, categorias, contas, sincronizacao, transacoes

validar_config_api()

app = FastAPI(title="API Financeira")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(categorias.router)
app.include_router(contas.router)
app.include_router(transacoes.router)
app.include_router(sincronizacao.router)


@app.get("/")
def health_check():
    return {"status": "ok"}


# Ponto de entrada da AWS Lambda
handler = Mangum(app)
