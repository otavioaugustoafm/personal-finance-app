import os
from datetime import date

import pytest

from tests.test_sync_db import ClienteFalso, t  # reaproveita o cliente falso

TEST_DB = os.getenv("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(not TEST_DB, reason="defina TEST_DATABASE_URL (banco descartavel!)")


@pytest.fixture
def api():
    from fastapi.testclient import TestClient
    from src.main import app
    from src.sync import sincronizar

    cliente = ClienteFalso(transacoes={
        "cc-1": [t("a", desc="PIX MERCADO", amount=-50, operationType="PIX"),
                 t("b", desc="Salario", amount=3000),
                 t("f", desc="PAGAMENTO FATURA CARTAO", amount=-300, data="2026-11-08T00:00:00.000Z")],
        "cart-1": [t("c", desc="Loja", amount=80)]})
    sincronizar(cliente, ["item-1"], date(2026, 11, 9))
    c = TestClient(app)
    token = c.post("/api/v1/auth/login", json={"senha": "senha-de-teste-123"}).json()["token"]
    c.headers.update({"Authorization": f"Bearer {token}"})
    return c


def test_rotas_exigem_login(api):
    from fastapi.testclient import TestClient
    from src.main import app
    anonimo = TestClient(app)
    for rota in ("/api/v1/transacoes", "/api/v1/contas", "/api/v1/sincronizacao/status"):
        assert anonimo.get(rota).status_code == 401
    assert anonimo.post("/api/v1/transacoes/categorizar-em-lote", json={"ids": []}).status_code == 401


def test_listagem_totais_e_filtros(api):
    r = api.get("/api/v1/transacoes").json()
    assert len(r["transacoes"]) == 3                       # fatura fica fora do fluxo
    assert float(r["totais"]["saidas"]) == 130 and float(r["totais"]["entradas"]) == 3000
    assert len(api.get("/api/v1/transacoes?incluir_ignoradas=true").json()["transacoes"]) == 4
    assert len(api.get("/api/v1/transacoes?direcao=ENTRADA").json()["transacoes"]) == 1
    assert len(api.get("/api/v1/transacoes?de=2026-11-06").json()["transacoes"]) == 0


def test_categorizar_uma_e_remover(api):
    cat = api.post("/api/v1/categorias", json={"nome": "Mercado", "tipo": "SAIDA", "cor": "#10b981"}).json()["id"]
    tid = next(x["id"] for x in api.get("/api/v1/transacoes").json()["transacoes"] if x["descricao"] == "PIX MERCADO")
    assert api.patch(f"/api/v1/transacoes/{tid}", json={"categoria_id": cat}).json()["categoria_id"] == cat
    assert len(api.get("/api/v1/transacoes?sem_categoria=true").json()["transacoes"]) == 2
    assert api.patch(f"/api/v1/transacoes/{tid}", json={"categoria_id": None}).json()["categoria_id"] is None
    assert api.patch(f"/api/v1/transacoes/{tid}", json={}).status_code == 400
    ruim = "11111111-1111-1111-1111-111111111111"
    assert api.patch(f"/api/v1/transacoes/{tid}", json={"categoria_id": ruim}).status_code == 422
    assert api.patch(f"/api/v1/transacoes/{ruim}", json={"ignorar_no_fluxo": True}).status_code == 404


def test_categorizar_em_lote(api):
    cat = api.post("/api/v1/categorias", json={"nome": "Lazer", "tipo": "SAIDA"}).json()["id"]
    ids = [x["id"] for x in api.get("/api/v1/transacoes?direcao=SAIDA").json()["transacoes"]]
    assert len(ids) == 2
    assert api.post("/api/v1/transacoes/categorizar-em-lote", json={"ids": ids, "categoria_id": cat}).json() == {"atualizadas": 2}
    assert len(api.get(f"/api/v1/transacoes?categoria_id={cat}").json()["transacoes"]) == 2
    ruim = "11111111-1111-1111-1111-111111111111"
    assert api.post("/api/v1/transacoes/categorizar-em-lote", json={"ids": ids, "categoria_id": ruim}).status_code == 422
    assert api.post("/api/v1/transacoes/categorizar-em-lote", json={"ids": []}).status_code == 422


def test_contas_e_status(api):
    contas = {c["tipo"]: c["saldo"] for c in api.get("/api/v1/contas").json()["contas"]}
    assert contas == {"CORRENTE": 1200.5, "CARTAO_CREDITO": 300.0}
    s = api.get("/api/v1/sincronizacao/status").json()
    assert s["ultima"]["status"] == "OK" and s["conexoes"][0]["dias_para_expirar"] is not None
