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
    c.pluggy = cliente  # o teste pode mudar o que o "banco" devolve na proxima sincronizacao
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


# ---------------------- edicao completa ----------------------
def _id(api, descricao):
    return next(x["id"] for x in api.get("/api/v1/transacoes?incluir_ignoradas=true").json()["transacoes"] if x["descricao"] == descricao)


def test_editar_varios_atributos_de_uma_vez(api):
    tid = _id(api, "PIX MERCADO")
    cat = api.post("/api/v1/categorias", json={"nome": "Mercado", "tipo": "SAIDA"}).json()["id"]
    r = api.patch(f"/api/v1/transacoes/{tid}", json={"descricao": "Feira do bairro", "valor": "55.90", "metodo": "DEBITO",
                                                      "data": "2026-11-04", "categoria_id": cat}).json()
    assert (r["descricao"], float(r["valor"]), r["metodo"], r["data"], r["categoria_id"]) == ("Feira do bairro", 55.9, "DEBITO", "2026-11-04", cat)
    assert sorted(r["campos_editados"]) == ["data", "descricao", "metodo", "valor"]  # categoria nao conta como edicao do banco
    assert r["original"]["descricao"] == "PIX MERCADO" and r["original"]["valor"] == "50.00"
    assert float(api.get("/api/v1/transacoes").json()["totais"]["saidas"]) == 55.9 + 80


def test_sincronizar_nao_desfaz_edicao_mas_atualiza_o_resto(api):
    tid = _id(api, "PIX MERCADO")
    api.patch(f"/api/v1/transacoes/{tid}", json={"descricao": "Feira do bairro", "valor": "55.90"})
    from src.sync import sincronizar
    # o banco corrige valor, descricao e data da transacao
    api.pluggy.transacoes_por_conta["cc-1"][0] = t("a", desc="PIX MERCADO CENTRAL", amount=-52, data="2026-11-06T00:00:00.000Z", operationType="PIX")
    sincronizar(api.pluggy, ["item-1"], date(2026, 11, 9))
    r = next(x for x in api.get("/api/v1/transacoes?incluir_ignoradas=true").json()["transacoes"] if x["id"] == tid)
    assert r["descricao"] == "Feira do bairro" and float(r["valor"]) == 55.9      # edicoes preservadas
    assert r["data"] == "2026-11-06"                                               # o que voce nao editou acompanha o banco
    assert r["original"]["descricao"] == "PIX MERCADO CENTRAL" and r["original"]["valor"] == "52.00"


def test_voltar_ao_valor_do_banco_deixa_de_ser_edicao(api):
    tid = _id(api, "PIX MERCADO")
    api.patch(f"/api/v1/transacoes/{tid}", json={"valor": "60"})
    r = api.patch(f"/api/v1/transacoes/{tid}", json={"valor": "50.00"}).json()
    assert r["campos_editados"] == []


def test_restaurar_volta_ao_que_o_banco_informou(api):
    tid = _id(api, "PIX MERCADO")
    cat = api.post("/api/v1/categorias", json={"nome": "Mercado", "tipo": "SAIDA"}).json()["id"]
    api.patch(f"/api/v1/transacoes/{tid}", json={"descricao": "X", "valor": "1", "direcao": "ENTRADA", "metodo": "OUTRO",
                                                  "parcela_atual": 1, "total_parcelas": 2, "categoria_id": cat})
    r = api.post(f"/api/v1/transacoes/{tid}/restaurar").json()
    assert (r["descricao"], float(r["valor"]), r["direcao"], r["metodo"], r["parcela_atual"]) == ("PIX MERCADO", 50.0, "SAIDA", "PIX", None)
    assert r["campos_editados"] == [] and r["categoria_id"] == cat  # a categoria e sua e permanece
    assert api.post("/api/v1/transacoes/11111111-1111-1111-1111-111111111111/restaurar").status_code == 404


def test_id_mudou_no_pluggy_e_a_transacao_estava_editada(api):
    from src.sync import sincronizar
    tid = _id(api, "PIX MERCADO")
    cat = api.post("/api/v1/categorias", json={"nome": "Mercado", "tipo": "SAIDA"}).json()["id"]
    api.patch(f"/api/v1/transacoes/{tid}", json={"descricao": "Feira do bairro", "categoria_id": cat})
    api.pluggy.transacoes_por_conta["cc-1"][0] = t("novo-id", desc="PIX MERCADO", amount=-50, operationType="PIX")  # delete + create
    sincronizar(api.pluggy, ["item-1"], date(2026, 11, 9))
    todas = api.get("/api/v1/transacoes?incluir_ignoradas=true").json()["transacoes"]
    assert len(todas) == 4  # nao duplicou
    r = next(x for x in todas if x["descricao"] == "Feira do bairro")  # a edicao e a categoria vieram junto
    assert r["categoria_id"] == cat and r["campos_editados"] == ["descricao"]


def test_edicao_invalida_e_rejeitada(api):
    tid = _id(api, "PIX MERCADO")
    for corpo in ({"valor": "0"}, {"valor": "-5"}, {"valor": "abc"}, {"valor": "1.234"}, {"descricao": ""}, {"descricao": None},
                  {"metodo": "CHEQUE"}, {"direcao": "X"}, {"data": "ontem"}, {"parcela_atual": 5, "total_parcelas": 2}, {"parcela_atual": 0}):
        assert api.patch(f"/api/v1/transacoes/{tid}", json=corpo).status_code == 422, corpo
    api.patch(f"/api/v1/transacoes/{tid}", json={"total_parcelas": 3})
    assert api.patch(f"/api/v1/transacoes/{tid}", json={"parcela_atual": 9}).status_code == 422  # coerencia com o total ja salvo
    assert api.patch("/api/v1/transacoes/11111111-1111-1111-1111-111111111111", json={"descricao": "x"}).status_code == 404
    assert api.get("/api/v1/transacoes").json()["totais"]["saidas"] == 130  # nada foi alterado pelas tentativas invalidas


def test_contas_trazem_limite_e_proximas_faturas(api):
    from datetime import datetime, timedelta, timezone
    from src.sync import sincronizar
    hoje = datetime.now(timezone(timedelta(hours=-3))).date()
    def fatura(id_, dias, total):
        return {"id": id_, "dueDate": f"{hoje + timedelta(days=dias)}T00:00:00", "totalAmount": total, "payments": []}
    api.pluggy.faturas_por_conta["cart-1"] = [fatura("passada", -20, 700), fatura("proxima", 5, 1500), fatura("seguinte", 35, 900), fatura("longe", 65, 100)]
    sincronizar(api.pluggy, ["item-1"], date(2026, 11, 9))
    cartao = next(c for c in api.get("/api/v1/contas").json()["contas"] if c["tipo"] == "CARTAO_CREDITO")
    assert (cartao["saldo"], cartao["limite_total"], cartao["limite_disponivel"]) == (300.0, 5000.0, 2600.0)
    assert [f["total"] for f in cartao["proximas_faturas"]] == [1500.0, 900.0]  # so futuras, as 2 mais proximas, em ordem
    corrente = next(c for c in api.get("/api/v1/contas").json()["contas"] if c["tipo"] == "CORRENTE")
    assert corrente["proximas_faturas"] == []
