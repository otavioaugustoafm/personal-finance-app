import os

import pytest

TEST_DB = os.getenv("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="defina TEST_DATABASE_URL (banco descartavel!)")

PERIODO = "2026-11"


@pytest.fixture
def api():
    from fastapi.testclient import TestClient
    from src.main import app

    c = TestClient(app)
    token = c.post("/api/v1/auth/login", json={"senha": "senha-de-teste-123"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


def criar(api, **kw):
    corpo = {"periodo": PERIODO, "tipo": "ENTRADA", "descricao": "Salario", "valor": "3000.00", **kw}
    r = api.post("/api/v1/previsoes", json=corpo)
    assert r.status_code == 201, r.text
    return r.json()


def test_exige_login():
    from fastapi.testclient import TestClient
    from src.main import app
    anonimo = TestClient(app)
    assert anonimo.get(f"/api/v1/previsoes?periodo={PERIODO}").status_code == 401
    assert anonimo.post("/api/v1/previsoes", json={}).status_code == 401
    assert anonimo.delete("/api/v1/previsoes/11111111-1111-1111-1111-111111111111").status_code == 401


def test_criar_e_listar_so_do_periodo_pedido(api):
    a = criar(api)
    criar(api, descricao="Aluguel", tipo="SAIDA", valor="1200")
    criar(api, periodo="2026-12", descricao="Decimo terceiro", valor="2000")
    lista = api.get(f"/api/v1/previsoes?periodo={PERIODO}").json()["previsoes"]
    assert [p["descricao"] for p in lista] == ["Salario", "Aluguel"]
    assert (a["tipo"], float(a["valor"]), a["concluida"]) == ("ENTRADA", 3000.0, False)
    assert len(api.get("/api/v1/previsoes?periodo=2026-12").json()["previsoes"]) == 1
    assert api.get("/api/v1/previsoes?periodo=2027-01").json()["previsoes"] == []


def test_descricao_e_espacada_e_limpa(api):
    assert criar(api, descricao="   Freela   ")["descricao"] == "Freela"


def test_concluir_editar_e_ordenar(api):
    a = criar(api, descricao="A")
    b = criar(api, descricao="B")
    r = api.patch(f"/api/v1/previsoes/{a['id']}", json={"concluida": True}).json()
    assert r["concluida"] is True
    r = api.patch(f"/api/v1/previsoes/{b['id']}", json={"descricao": "B corrigida", "valor": "99.90", "tipo": "SAIDA"}).json()
    assert (r["descricao"], float(r["valor"]), r["tipo"]) == ("B corrigida", 99.9, "SAIDA")
    lista = api.get(f"/api/v1/previsoes?periodo={PERIODO}").json()["previsoes"]
    assert [p["descricao"] for p in lista] == ["B corrigida", "A"]  # as concluidas vao para o fim


def test_excluir(api):
    a = criar(api)
    assert api.delete(f"/api/v1/previsoes/{a['id']}").status_code == 204
    assert api.get(f"/api/v1/previsoes?periodo={PERIODO}").json()["previsoes"] == []
    assert api.delete(f"/api/v1/previsoes/{a['id']}").status_code == 404


def test_validacoes(api):
    ruim = "11111111-1111-1111-1111-111111111111"
    base = {"periodo": PERIODO, "tipo": "ENTRADA", "descricao": "x", "valor": "10"}
    for troca in ({"valor": "0"}, {"valor": "-5"}, {"valor": "abc"}, {"valor": "1.234"}, {"descricao": ""}, {"descricao": "   "},
                  {"tipo": "OUTRO"}, {"periodo": "2026-13"}, {"periodo": "26-11"}, {"periodo": "novembro"}):
        assert api.post("/api/v1/previsoes", json={**base, **troca}).status_code == 422, troca
    a = criar(api)
    for corpo in ({"valor": "0"}, {"descricao": ""}, {"descricao": None}, {"valor": None}, {"concluida": None}, {"tipo": "X"}):
        assert api.patch(f"/api/v1/previsoes/{a['id']}", json=corpo).status_code == 422, corpo
    assert api.patch(f"/api/v1/previsoes/{a['id']}", json={}).status_code == 400
    assert api.patch(f"/api/v1/previsoes/{ruim}", json={"concluida": True}).status_code == 404
    assert api.get("/api/v1/previsoes?periodo=lixo").status_code == 422
    assert api.get("/api/v1/previsoes").status_code == 422
    assert float(api.get(f"/api/v1/previsoes?periodo={PERIODO}").json()["previsoes"][0]["valor"]) == 3000.0  # nada foi alterado
