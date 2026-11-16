"""Cliente minimo da API do Pluggy (somente leitura), com reautenticacao e retentativas."""
import os
import time
from datetime import date

import requests

BASE_URL = "https://api.pluggy.ai"
TIMEOUT = 30
MAX_TENTATIVAS = 4
MAX_PAGINAS = 200  # trava de seguranca contra paginacao infinita


class PluggyError(Exception):
    """Falha ao falar com a API do Pluggy."""


def configuracao_pluggy() -> tuple[str, str, list[str]]:
    client_id = os.getenv("PLUGGY_CLIENT_ID", "").strip()
    client_secret = os.getenv("PLUGGY_CLIENT_SECRET", "").strip()
    item_ids = [i.strip() for i in os.getenv("PLUGGY_ITEM_IDS", "").split(",") if i.strip()]
    faltando = [
        nome
        for nome, valor in (
            ("PLUGGY_CLIENT_ID", client_id),
            ("PLUGGY_CLIENT_SECRET", client_secret),
            ("PLUGGY_ITEM_IDS", item_ids),
        )
        if not valor
    ]
    if faltando:
        raise RuntimeError("Variaveis de ambiente ausentes: " + ", ".join(faltando))
    return client_id, client_secret, item_ids


class PluggyClient:
    def __init__(self, client_id: str, client_secret: str, sessao: requests.Session | None = None):
        self._client_id = client_id
        self._client_secret = client_secret
        self._sessao = sessao or requests.Session()
        self._api_key: str | None = None  # vale 2 horas; reaproveitada ate dar 401

    # ---------- infraestrutura ----------
    def _autenticar(self) -> None:
        try:
            r = self._sessao.post(
                f"{BASE_URL}/auth",
                json={"clientId": self._client_id, "clientSecret": self._client_secret},
                timeout=TIMEOUT,
            )
        except requests.RequestException as erro:
            raise PluggyError(f"Falha de rede na autenticacao: {erro}") from erro
        if r.status_code != 200:
            # nao inclui o corpo para nunca vazar credenciais em logs
            raise PluggyError(f"Autenticacao recusada pelo Pluggy (HTTP {r.status_code}). Confira CLIENT_ID e CLIENT_SECRET.")
        self._api_key = r.json()["apiKey"]

    def _requisitar(self, caminho_ou_url: str, params: dict | None = None) -> dict:
        url = caminho_ou_url if caminho_ou_url.startswith("http") else f"{BASE_URL}{caminho_ou_url}"
        reautenticou = False
        for tentativa in range(MAX_TENTATIVAS):
            if not self._api_key:
                self._autenticar()
            try:
                r = self._sessao.get(url, params=params, headers={"X-API-KEY": self._api_key}, timeout=TIMEOUT)
            except requests.RequestException as erro:
                if tentativa == MAX_TENTATIVAS - 1:
                    raise PluggyError(f"Falha de rede: {erro}") from erro
                time.sleep(2**tentativa)
                continue
            if r.status_code == 401 and not reautenticou:
                self._api_key, reautenticou = None, True
                continue
            if r.status_code == 429 or r.status_code >= 500:
                if tentativa == MAX_TENTATIVAS - 1:
                    raise PluggyError(f"Pluggy indisponivel (HTTP {r.status_code}) em {url.split('?')[0]}")
                try:
                    espera = float(r.headers.get("Retry-After", 2**tentativa))
                except ValueError:
                    espera = 2**tentativa
                time.sleep(min(espera, 30))
                continue
            if r.status_code >= 400:
                raise PluggyError(f"HTTP {r.status_code} em {url.split('?')[0]}: {r.text[:300]}")
            return r.json()
        raise PluggyError("Tentativas esgotadas.")

    # ---------- recursos ----------
    def item(self, item_id: str) -> dict:
        return self._requisitar(f"/items/{item_id}")

    def contas(self, item_id: str) -> list[dict]:
        resultados: list[dict] = []
        pagina = 1
        while pagina <= MAX_PAGINAS:
            resp = self._requisitar("/accounts", {"itemId": item_id, "page": pagina})
            resultados.extend(resp.get("results", []))
            if pagina >= resp.get("totalPages", 1):
                break
            pagina += 1
        return resultados

    def faturas(self, conta_id: str) -> list[dict]:
        """Faturas do cartao (so existem em conexoes Open Finance regulado)."""
        resultados: list[dict] = []
        pagina = 1
        while pagina <= MAX_PAGINAS:
            resp = self._requisitar("/bills", {"accountId": conta_id, "page": pagina})
            resultados.extend(resp.get("results", []))
            if pagina >= resp.get("totalPages", 1):
                break
            pagina += 1
        return resultados

    def transacoes(self, conta_id: str, data_de: date) -> list[dict]:
        """Todas as transacoes da conta a partir de data_de (paginacao por cursor, 500 por pagina)."""
        resultados: list[dict] = []
        resp = self._requisitar("/v2/transactions", {"accountId": conta_id, "dateFrom": data_de.isoformat()})
        for _ in range(MAX_PAGINAS):
            resultados.extend(resp.get("results", []))
            proximo = resp.get("next")  # query string pronta: "?accountId=...&after=..."
            if not proximo:
                return resultados
            resp = self._requisitar(f"{BASE_URL}/v2/transactions{proximo}")
        raise PluggyError("Paginacao de transacoes nao terminou (limite de paginas).")
