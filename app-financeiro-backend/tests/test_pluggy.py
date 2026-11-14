from datetime import date

import pytest

from src import pluggy
from src.pluggy import PluggyClient, PluggyError


class Resp:
    def __init__(self, status=200, corpo=None, headers=None):
        self.status_code, self._corpo, self.headers, self.text = status, corpo or {}, headers or {}, str(corpo)

    def json(self):
        return self._corpo


class SessaoFalsa:
    """Responde em ordem; guarda as chamadas para conferir."""
    def __init__(self, posts=(), gets=()):
        self.posts, self.gets, self.chamadas = list(posts), list(gets), []

    def post(self, url, **kw):
        self.chamadas.append(("POST", url, kw)); return self.posts.pop(0)

    def get(self, url, **kw):
        self.chamadas.append(("GET", url, kw)); return self.gets.pop(0)


@pytest.fixture(autouse=True)
def sem_espera(monkeypatch):
    monkeypatch.setattr(pluggy.time, "sleep", lambda _s: None)


def cliente(sessao):
    return PluggyClient("id", "segredo", sessao)


def test_paginacao_por_cursor_segue_o_next():
    s = SessaoFalsa(
        posts=[Resp(corpo={"apiKey": "K"})],
        gets=[Resp(corpo={"results": [{"id": 1}], "next": "?accountId=a&after=XYZ"}),
              Resp(corpo={"results": [{"id": 2}], "next": None})])
    assert cliente(s).transacoes("a", date(2026, 1, 1)) == [{"id": 1}, {"id": 2}]
    _, url1, kw1 = s.chamadas[1]
    assert url1.endswith("/v2/transactions") and kw1["params"] == {"accountId": "a", "dateFrom": "2026-01-01"}
    assert s.chamadas[2][1] == "https://api.pluggy.ai/v2/transactions?accountId=a&after=XYZ"
    assert kw1["headers"] == {"X-API-KEY": "K"}


def test_reautentica_quando_a_chave_expira_e_reaproveita_a_chave():
    s = SessaoFalsa(posts=[Resp(corpo={"apiKey": "K1"}), Resp(corpo={"apiKey": "K2"})],
                    gets=[Resp(401), Resp(corpo={"id": "i"}), Resp(corpo={"id": "j"})])
    c = cliente(s)
    assert c.item("i") == {"id": "i"}
    assert c.item("j") == {"id": "j"}
    assert sum(1 for m, *_ in s.chamadas if m == "POST") == 2  # so reautenticou uma vez, sem uma chave por chamada


def test_429_tenta_de_novo():
    s = SessaoFalsa(posts=[Resp(corpo={"apiKey": "K"})],
                    gets=[Resp(429, headers={"Retry-After": "1"}), Resp(corpo={"ok": True})])
    assert cliente(s).item("i") == {"ok": True}


def test_erro_4xx_nao_repete_e_credencial_errada_nao_vaza_corpo():
    s = SessaoFalsa(posts=[Resp(corpo={"apiKey": "K"})], gets=[Resp(404, corpo={"message": "nao achei"})])
    with pytest.raises(PluggyError, match="HTTP 404"):
        cliente(s).item("i")
    s2 = SessaoFalsa(posts=[Resp(401, corpo={"clientSecret": "segredo-vazado"})])
    with pytest.raises(PluggyError) as e:
        cliente(s2).item("i")
    assert "segredo" not in str(e.value).replace("CLIENT_SECRET", "")


def test_contas_paginadas():
    s = SessaoFalsa(posts=[Resp(corpo={"apiKey": "K"})],
                    gets=[Resp(corpo={"results": [{"id": "a"}], "totalPages": 2}),
                          Resp(corpo={"results": [{"id": "b"}], "totalPages": 2})])
    assert [c["id"] for c in cliente(s).contas("i")] == ["a", "b"]
