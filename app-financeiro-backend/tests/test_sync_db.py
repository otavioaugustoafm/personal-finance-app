import os
from datetime import date

import psycopg
import pytest
from psycopg.rows import dict_row

TEST_DB = os.getenv("TEST_DATABASE_URL", "")
pytestmark = pytest.mark.skipif(
    not TEST_DB,
    reason="defina TEST_DATABASE_URL (banco descartavel!) para rodar os testes de banco",
)

HOJE = date(2026, 11, 9)


class ClienteFalso:
    def __init__(self, item=None, contas=None, transacoes=None):
        self._item = item or {"id": "item-1", "status": "UPDATED", "consentExpiresAt": "2027-06-01T00:00:00.000Z",
                              "connector": {"name": "MeuPluggy"}}
        self._contas = contas if contas is not None else [
            {"id": "cc-1", "type": "BANK", "subtype": "CHECKING_ACCOUNT", "name": "Conta Corrente", "balance": 1200.5},
            {"id": "cart-1", "type": "CREDIT", "subtype": "CREDIT_CARD", "name": "Cartao", "balance": 300},
        ]
        self.transacoes_por_conta = transacoes or {"cc-1": [], "cart-1": []}

    def item(self, _): return self._item
    def contas(self, _): return self._contas
    def transacoes(self, conta_id, _data_de): return list(self.transacoes_por_conta[conta_id])


def t(id_, desc="Mercado", amount=-50, data="2026-11-05T00:00:00.000Z", **kw):
    return {"id": id_, "description": desc, "amount": amount, "date": data,
            "type": "DEBIT" if amount < 0 else "CREDIT", "status": "POSTED", **kw}


def rodar(cliente, hoje=HOJE):
    from src.sync import sincronizar
    return sincronizar(cliente, ["item-1"], hoje)


def consultar(sql, *args):
    with psycopg.connect(TEST_DB, row_factory=dict_row) as conn:
        return conn.execute(sql, args).fetchall()


def test_primeira_carga_e_idempotencia():
    c = ClienteFalso(transacoes={"cc-1": [t("a"), t("b", amount=900, desc="Salario")], "cart-1": [t("c", amount=80)]})
    r1 = rodar(c)
    assert (r1["status"], r1["novas"]) == ("OK", 3)
    r2 = rodar(c)
    assert (r2["status"], r2["novas"], r2["atualizadas"]) == ("OK", 0, 3)
    assert consultar("SELECT count(*) AS n FROM transacoes")[0]["n"] == 3
    assert {r["tipo"]: float(r["saldo"]) for r in consultar("SELECT tipo, saldo FROM contas")} == {
        "CORRENTE": 1200.5, "CARTAO_CREDITO": 300.0}


def test_categoria_sobrevive_a_atualizacao():
    c = ClienteFalso(transacoes={"cc-1": [t("a")], "cart-1": []})
    rodar(c)
    cat = consultar("INSERT INTO categorias (nome, tipo) VALUES ('Alimentacao','SAIDA') RETURNING id")[0]["id"]
    with psycopg.connect(TEST_DB) as conn:
        conn.execute("UPDATE transacoes SET categoria_id = %s, ignorar_no_fluxo = true", (cat,))
    c.transacoes_por_conta["cc-1"] = [t("a", amount=-55)]  # banco corrigiu o valor
    rodar(c)
    linha = consultar("SELECT valor, categoria_id, ignorar_no_fluxo FROM transacoes")[0]
    assert float(linha["valor"]) == 55 and linha["categoria_id"] == cat and linha["ignorar_no_fluxo"] is True


def test_id_mudou_no_pluggy_herda_categoria():
    c = ClienteFalso(transacoes={"cc-1": [], "cart-1": [t("velho", amount=120, desc="Loja X")]})
    rodar(c)
    cat = consultar("INSERT INTO categorias (nome, tipo) VALUES ('Compras','SAIDA') RETURNING id")[0]["id"]
    with psycopg.connect(TEST_DB) as conn:
        conn.execute("UPDATE transacoes SET categoria_id = %s", (cat,))
    c.transacoes_por_conta["cart-1"] = [t("novo", amount=120, desc="Loja X")]  # delete + create no Pluggy
    r = rodar(c)
    linhas = consultar("SELECT provedor_transacao_id, categoria_id, sumiu_em FROM transacoes")
    assert len(linhas) == 1 and linhas[0]["provedor_transacao_id"] == "novo"
    assert linhas[0]["categoria_id"] == cat and linhas[0]["sumiu_em"] is None
    assert r["novas"] == 1


def test_sumiu_e_reapareceu():
    c = ClienteFalso(transacoes={"cc-1": [t("a"), t("b", desc="Outra", amount=-5)], "cart-1": []})
    rodar(c)
    c.transacoes_por_conta["cc-1"] = [t("b", desc="Outra", amount=-5)]
    rodar(c)
    assert consultar("SELECT sumiu_em FROM transacoes WHERE provedor_transacao_id = 'a'")[0]["sumiu_em"] is not None
    c.transacoes_por_conta["cc-1"] = [t("a"), t("b", desc="Outra", amount=-5)]
    rodar(c)
    assert consultar("SELECT sumiu_em FROM transacoes WHERE provedor_transacao_id = 'a'")[0]["sumiu_em"] is None


def test_lista_vazia_nao_apaga_nada():
    c = ClienteFalso(transacoes={"cc-1": [t("a")], "cart-1": []})
    rodar(c)
    c.transacoes_por_conta["cc-1"] = []
    r = rodar(c)
    assert consultar("SELECT sumiu_em FROM transacoes")[0]["sumiu_em"] is None
    assert any("zero transacoes" in a for a in r["avisos"])


def test_autorizacao_expirada_nao_sincroniza_e_registra_erro():
    c = ClienteFalso(item={"id": "item-1", "status": "UPDATED", "consentExpiresAt": "2026-01-01T00:00:00.000Z"})
    r = rodar(c)
    assert r["status"] == "ERRO" and "expirada" in r["erros"][0]
    assert consultar("SELECT count(*) AS n FROM transacoes")[0]["n"] == 0
    assert consultar("SELECT status FROM sincronizacoes")[0]["status"] == "ERRO"


def test_aviso_de_expiracao_proxima():
    c = ClienteFalso(item={"id": "item-1", "status": "UPDATED", "consentExpiresAt": "2099-01-01T00:00:00.000Z"})
    assert rodar(c)["avisos"] == []
    from datetime import datetime, timedelta, timezone
    perto = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat().replace("+00:00", "Z")
    c = ClienteFalso(item={"id": "item-1", "status": "UPDATED", "consentExpiresAt": perto})
    assert any("expira em" in a for a in rodar(c)["avisos"])
