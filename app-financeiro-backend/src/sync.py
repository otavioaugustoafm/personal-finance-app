"""Sincronizacao Meu Pluggy -> Neon.

Roda uma vez por dia (EventBridge -> Lambda) ou na mao: `python -m src.sync`.

Regras que protegem o que voce ja fez no app:
- a sincronizacao NUNCA altera a categoria nem o "ignorar no fluxo" de uma transacao existente;
- o id de uma transacao pode mudar no Pluggy (principalmente no cartao, perto do fechamento da fatura);
  quando isso acontece a categoria e herdada pela nova transacao com mesma data + valor + descricao;
- transacao que some do banco e marcada (sumiu_em) e nao apagada; se reaparecer, volta ao normal.
"""
import json
import logging
import unicodedata
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from src.database import get_db_connection
from src.pluggy import PluggyClient, PluggyError, configuracao_pluggy

logger = logging.getLogger("sync")

FUSO_BRASILIA = timezone(timedelta(hours=-3))
JANELA_PRIMEIRA_CARGA_DIAS = 365  # o Pluggy guarda ate 12 meses
JANELA_INCREMENTAL_DIAS = 60
AVISO_EXPIRACAO_DIAS = 30


class ItemIndisponivel(PluggyError):
    """O item existe, mas nao da para ler dados dele agora (ex.: autorizacao expirada)."""


# ======================= normalizacao (funcoes puras) =======================
def _sem_acento_maiusculo(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode().upper()


def _data_transacao(iso: str) -> date:
    """O Pluggy manda datas como 'AAAA-MM-DDT00:00:00.000Z'. Meia-noite UTC = data pura (nao converte);
    com horario de verdade, converte para Brasilia."""
    dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if dt.tzinfo is None or dt.time() == time(0, 0):
        return dt.date()
    return dt.astimezone(FUSO_BRASILIA).date()


def tipo_conta(conta: dict) -> str | None:
    if conta.get("type") == "CREDIT":
        return "CARTAO_CREDITO"
    if conta.get("type") == "BANK":
        return "POUPANCA" if conta.get("subtype") == "SAVINGS_ACCOUNT" else "CORRENTE"
    return None


def _metodo(tx: dict, tipo: str, desc: str) -> str:
    if tipo == "CARTAO_CREDITO":
        return "CREDITO"
    op = tx.get("operationType")
    forma = (tx.get("paymentData") or {}).get("paymentMethod")
    if op == "PIX" or forma == "PIX" or "PIX" in desc:
        return "PIX"
    if op == "CARTAO" or ("DEBITO" in desc and ("COMPRA" in desc or "CARTAO" in desc)):
        return "DEBITO"
    return "OUTRO"


def _eh_pagamento_de_fatura(tx: dict, tipo: str, desc: str, amount: Decimal) -> bool:
    """Pagamento de fatura nao e gasto novo (as compras ja foram contadas no cartao)."""
    op = tx.get("operationType")
    if op == "PAGAMENTO_FATURA":
        return True
    if tipo == "CARTAO_CREDITO":
        return amount < 0 and op == "PAGAMENTO"
    return "FATURA" in desc or ("PAG" in desc and "CARTAO" in desc and "CRED" in desc)


def normalizar_transacao(tx: dict, tipo: str) -> dict | None:
    """Converte uma transacao do Pluggy para o formato do nosso ledger. None = ignorar (valor zero)."""
    if tx.get("amount") is None:
        return None
    amount = Decimal(str(tx["amount"]))
    valor = abs(amount).quantize(Decimal("0.01"))
    if valor == 0:
        return None

    if tipo == "CARTAO_CREDITO":  # cartao: positivo = compra, negativo = pagamento/estorno
        direcao = "SAIDA" if amount > 0 else "ENTRADA"
    elif tx.get("type") in ("DEBIT", "CREDIT"):
        direcao = "SAIDA" if tx["type"] == "DEBIT" else "ENTRADA"
    else:
        direcao = "SAIDA" if amount < 0 else "ENTRADA"

    descricao = (tx.get("description") or tx.get("descriptionRaw") or "(sem descricao)").strip()
    desc_norm = _sem_acento_maiusculo(descricao)
    cartao = tx.get("creditCardMetadata") or {}

    return {
        "provedor_transacao_id": tx["id"],
        "provedor_id": tx.get("providerId"),
        "data": _data_transacao(tx["date"]),
        "descricao": descricao,
        "valor": valor,
        "direcao": direcao,
        "metodo": _metodo(tx, tipo, desc_norm),
        "status": "PENDENTE" if tx.get("status") == "PENDING" else "EFETIVADA",
        "parcela_atual": cartao.get("installmentNumber"),
        "total_parcelas": cartao.get("totalInstallments"),
        "operacao": tx.get("operationType"),
        "ignorar_no_fluxo": _eh_pagamento_de_fatura(tx, tipo, desc_norm, amount),
        "categoria_id": None,
        "bruto": tx,
    }


# ======================= gravacao =======================
UPSERT_TRANSACAO = """
INSERT INTO transacoes (conta_id, provedor_transacao_id, provedor_id, data, descricao, valor, direcao,
                        metodo, status, parcela_atual, total_parcelas, operacao, categoria_id,
                        ignorar_no_fluxo, bruto)
VALUES (%(conta_id)s, %(provedor_transacao_id)s, %(provedor_id)s, %(data)s, %(descricao)s, %(valor)s,
        %(direcao)s, %(metodo)s, %(status)s, %(parcela_atual)s, %(total_parcelas)s, %(operacao)s,
        %(categoria_id)s, %(ignorar_no_fluxo)s, %(bruto)s)
ON CONFLICT (conta_id, provedor_transacao_id) DO UPDATE SET
  provedor_id = EXCLUDED.provedor_id, data = EXCLUDED.data, descricao = EXCLUDED.descricao,
  valor = EXCLUDED.valor, direcao = EXCLUDED.direcao, metodo = EXCLUDED.metodo,
  status = EXCLUDED.status, parcela_atual = EXCLUDED.parcela_atual,
  total_parcelas = EXCLUDED.total_parcelas, operacao = EXCLUDED.operacao,
  bruto = EXCLUDED.bruto, sumiu_em = NULL, atualizado_em = now()
"""  # categoria_id e ignorar_no_fluxo ficam de fora do UPDATE de proposito


def _gravar_transacoes(cur, conta_id, remotas: list[dict], data_de: date) -> dict:
    cur.execute(
        """SELECT id, provedor_transacao_id, data, valor, descricao, categoria_id, ignorar_no_fluxo
             FROM transacoes WHERE conta_id = %s AND data >= %s""",
        (conta_id, data_de),
    )
    locais = {r["provedor_transacao_id"]: r for r in cur.fetchall()}
    ids_remotos = {t["provedor_transacao_id"] for t in remotas}
    orfas = [r for pid, r in locais.items() if pid not in ids_remotos]
    novas = [t for t in remotas if t["provedor_transacao_id"] not in locais]
    avisos: list[str] = []

    # Protecao: lista vazia com dados locais na janela quase sempre e problema de leitura, nao "apagaram tudo"
    if not remotas and orfas:
        avisos.append("O Pluggy devolveu zero transacoes para uma conta que ja tinha dados; nada foi alterado.")
        return {"novas": 0, "atualizadas": 0, "sumiram": 0, "avisos": avisos}

    # Id mudou no Pluggy (delete + create): a nova herda a categoria da antiga
    consumidas: set = set()
    for nova in novas:
        for orfa in orfas:
            if orfa["id"] in consumidas:
                continue
            if (orfa["data"], orfa["valor"], orfa["descricao"]) == (nova["data"], nova["valor"], nova["descricao"]):
                nova["categoria_id"] = orfa["categoria_id"]
                nova["ignorar_no_fluxo"] = orfa["ignorar_no_fluxo"]
                consumidas.add(orfa["id"])
                break
    if consumidas:
        cur.execute("DELETE FROM transacoes WHERE id = ANY(%s)", (list(consumidas),))

    linhas = [{**t, "conta_id": conta_id, "bruto": Jsonb(t["bruto"])} for t in remotas]
    if linhas:
        cur.executemany(UPSERT_TRANSACAO, linhas)

    sumidas = [o["id"] for o in orfas if o["id"] not in consumidas]
    if sumidas:
        cur.execute("UPDATE transacoes SET sumiu_em = now() WHERE id = ANY(%s) AND sumiu_em IS NULL", (sumidas,))
    return {
        "novas": len(novas),
        "atualizadas": len(remotas) - len(novas),
        "sumiram": len(sumidas),
        "avisos": avisos,
    }


def _parse_dt(valor: str | None) -> datetime | None:
    if not valor:
        return None
    return datetime.fromisoformat(valor.replace("Z", "+00:00"))


def _sincronizar_item(cliente, item_id: str, hoje: date) -> dict:
    agora = datetime.now(timezone.utc)
    item = cliente.item(item_id)
    expira = _parse_dt(item.get("consentExpiresAt"))
    rotulo = item_id[:8]
    avisos: list[str] = []

    if item.get("status") == "LOGIN_ERROR" or (expira and expira <= agora):
        _registrar_status_item(item_id, item, expira)
        raise ItemIndisponivel(
            f"Item {rotulo}: autorizacao do Meu Pluggy expirada ou com erro. Refaca em "
            "dashboard.pluggy.ai > Applications > Demo > Connect Account > MeuPluggy "
            "(e confira se o itemId mudou)."
        )
    if expira and (expira - agora).days <= AVISO_EXPIRACAO_DIAS:
        avisos.append(f"Item {rotulo}: a autorizacao do Meu Pluggy expira em {expira.date().isoformat()}. Renove antes.")

    contas_remotas = cliente.contas(item_id)
    if not contas_remotas:
        raise ItemIndisponivel(f"Item {rotulo}: nenhuma conta retornada (autorizacao pode ter lapsado).")

    # 1) banco: conexao, contas e se e a primeira carga de cada conta
    contas = []
    with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """INSERT INTO conexoes (provedor, provedor_item_id, instituicao, status,
                                     consentimento_expira_em, ultima_sincronizacao_em)
               VALUES ('PLUGGY', %s, %s, %s, %s, now())
               ON CONFLICT (provedor, provedor_item_id) DO UPDATE SET
                 status = EXCLUDED.status, consentimento_expira_em = EXCLUDED.consentimento_expira_em,
                 ultima_sincronizacao_em = now()
               RETURNING id""",
            (item_id, (item.get("connector") or {}).get("name") or "Meu Pluggy", item.get("status"), expira),
        )
        conexao_id = cur.fetchone()["id"]
        for c in contas_remotas:
            tipo = tipo_conta(c)
            if not tipo:
                continue
            cur.execute(
                """INSERT INTO contas (conexao_id, provedor_conta_id, tipo, nome, saldo, saldo_atualizado_em)
                   VALUES (%s, %s, %s, %s, %s, now())
                   ON CONFLICT (conexao_id, provedor_conta_id) DO UPDATE SET
                     tipo = EXCLUDED.tipo, nome = EXCLUDED.nome, saldo = EXCLUDED.saldo,
                     saldo_atualizado_em = now()
                   RETURNING id""",
                (conexao_id, c["id"], tipo, c.get("marketingName") or c.get("name"), c.get("balance")),
            )
            conta_id = cur.fetchone()["id"]
            cur.execute("SELECT EXISTS (SELECT 1 FROM transacoes WHERE conta_id = %s) AS tem", (conta_id,))
            contas.append((conta_id, c["id"], tipo, not cur.fetchone()["tem"]))

    # 2) Pluggy (sem segurar conexao com o banco)
    coletado = []
    for conta_id, remoto_id, tipo, primeira_carga in contas:
        data_de = hoje - timedelta(days=JANELA_PRIMEIRA_CARGA_DIAS if primeira_carga else JANELA_INCREMENTAL_DIAS)
        normalizadas = [n for n in (normalizar_transacao(t, tipo) for t in cliente.transacoes(remoto_id, data_de)) if n]
        coletado.append((conta_id, data_de, normalizadas))

    # 3) banco: grava tudo do item numa transacao so
    total = {"novas": 0, "atualizadas": 0, "sumiram": 0, "avisos": avisos}
    with get_db_connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        for conta_id, data_de, normalizadas in coletado:
            r = _gravar_transacoes(cur, conta_id, normalizadas, data_de)
            for chave in ("novas", "atualizadas", "sumiram"):
                total[chave] += r[chave]
            total["avisos"] += [f"Item {rotulo}: {a}" for a in r["avisos"]]
    return total


def _registrar_status_item(item_id: str, item: dict, expira: datetime | None) -> None:
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE conexoes SET status = %s, consentimento_expira_em = %s WHERE provedor_item_id = %s",
            (item.get("status"), expira, item_id),
        )


# ======================= orquestracao =======================
def sincronizar(cliente=None, item_ids: list[str] | None = None, hoje: date | None = None) -> dict:
    if cliente is None:
        client_id, client_secret, ids_env = configuracao_pluggy()
        cliente, item_ids = PluggyClient(client_id, client_secret), item_ids or ids_env
    hoje = hoje or datetime.now(FUSO_BRASILIA).date()

    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute("INSERT INTO sincronizacoes DEFAULT VALUES RETURNING id")
        log_id = cur.fetchone()[0]

    totais = {"novas": 0, "atualizadas": 0, "sumiram": 0}
    avisos: list[str] = []
    erros: list[str] = []
    for item_id in item_ids or []:
        try:
            r = _sincronizar_item(cliente, item_id, hoje)
            for chave in totais:
                totais[chave] += r[chave]
            avisos += r["avisos"]
        except Exception as erro:  # um item com problema nao pode derrubar os outros
            logger.exception("Falha ao sincronizar o item %s", item_id[:8])
            erros.append(f"{item_id[:8]}: {erro}")

    status = "OK" if not erros else ("ERRO" if len(erros) == len(item_ids or []) else "PARCIAL")
    with get_db_connection() as conn, conn.cursor() as cur:
        cur.execute(
            """UPDATE sincronizacoes SET finalizada_em = now(), status = %s, novas = %s, atualizadas = %s,
                      erro = %s, avisos = %s WHERE id = %s""",
            (status, totais["novas"], totais["atualizadas"], "; ".join(erros) or None, Jsonb(avisos), log_id),
        )
    return {"status": status, **totais, "avisos": avisos, "erros": erros}


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    resultado = sincronizar()
    print(json.dumps(resultado, ensure_ascii=False, indent=2))
    raise SystemExit(0 if resultado["status"] != "ERRO" else 1)
