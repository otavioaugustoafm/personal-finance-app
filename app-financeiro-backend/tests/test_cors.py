"""O navegador manda um "preflight" (OPTIONS) antes de cada chamada que nao seja GET/POST simples.
Se o metodo nao estiver liberado aqui, o painel mostra "nao foi possivel salvar" mesmo com a API funcionando.
Estes testes nao precisam de banco."""
import pytest
from fastapi.testclient import TestClient

from src.main import app

ORIGEM = "http://localhost:5173"  # padrao de ALLOWED_ORIGINS nos testes


@pytest.fixture(scope="module")
def cliente():
    return TestClient(app)


@pytest.mark.parametrize("metodo", ["GET", "POST", "PATCH", "PUT", "DELETE"])
def test_preflight_libera_todos_os_metodos_que_o_painel_usa(cliente, metodo):
    r = cliente.options("/api/v1/transacoes/x", headers={
        "Origin": ORIGEM, "Access-Control-Request-Method": metodo,
        "Access-Control-Request-Headers": "authorization,content-type"})
    assert r.status_code == 200, f"{metodo}: {r.text}"
    assert metodo in r.headers["access-control-allow-methods"]
    assert r.headers["access-control-allow-origin"] == ORIGEM


def test_origem_desconhecida_continua_bloqueada(cliente):
    r = cliente.options("/api/v1/transacoes/x", headers={"Origin": "https://site-estranho.com", "Access-Control-Request-Method": "PATCH"})
    assert "access-control-allow-origin" not in r.headers
