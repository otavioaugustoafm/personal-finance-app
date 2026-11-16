"""Mostra o que o Pluggy devolve para o cartao (limite, faturas, compras recentes), SEM dados pessoais.

Uso:  python -m src.diagnostico
Serve para entender diferencas entre o painel e o app do banco. Pode colar a saida numa conversa: numeros de
cartao, nomes e CPF sao omitidos. Ainda assim, confira antes de compartilhar.
"""
import json
from datetime import date, timedelta

from src.pluggy import PluggyClient, configuracao_pluggy


def main() -> None:
    client_id, client_secret, item_ids = configuracao_pluggy()
    cliente = PluggyClient(client_id, client_secret)
    saida = []
    for item_id in item_ids:
        item = cliente.item(item_id)
        info = {"status": item.get("status"), "consentExpiresAt": item.get("consentExpiresAt"),
                "conector": (item.get("connector") or {}).get("name"), "contas": []}
        for conta in cliente.contas(item_id):
            dados = {"type": conta.get("type"), "subtype": conta.get("subtype"), "balance": conta.get("balance")}
            if conta.get("type") == "CREDIT":
                credito = conta.get("creditData") or {}
                dados["creditData"] = {k: credito.get(k) for k in (
                    "creditLimit", "availableCreditLimit", "balanceDueDate", "balanceCloseDate", "minimumPayment")}
                try:
                    faturas = cliente.faturas(conta["id"])
                    dados["faturas"] = [{"vencimento": f.get("dueDate"), "fechamento": f.get("billClosingDate"),
                                         "total": f.get("totalAmount"),
                                         "pagamentos": round(sum(p.get("amount") or 0 for p in f.get("payments") or []), 2)}
                                        for f in sorted(faturas, key=lambda f: f.get("dueDate") or "")[-4:]]
                except Exception as erro:  # diagnostico: mostra o erro em vez de parar
                    dados["faturas"] = f"indisponivel: {erro}"
                compras = cliente.transacoes(conta["id"], date.today() - timedelta(days=60))
                futuras = [t for t in compras if (t.get("date") or "")[:10] > date.today().isoformat()]
                dados["transacoes_60_dias"] = {
                    "quantidade": len(compras),
                    "parceladas": sum(1 for t in compras if (t.get("creditCardMetadata") or {}).get("totalInstallments", 1) > 1),
                    "com_data_futura": len(futuras),
                    "soma_compras": round(sum(t["amount"] for t in compras if t.get("amount", 0) > 0), 2),
                    "soma_compras_futuras": round(sum(t["amount"] for t in futuras if t.get("amount", 0) > 0), 2),
                }
            info["contas"].append(dados)
        saida.append(info)
    print(json.dumps(saida, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
