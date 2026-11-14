from datetime import date
from decimal import Decimal

from src.sync import _data_transacao, normalizar_transacao, tipo_conta


def tx(**kw):
    base = {"id": "t1", "description": "Compra", "amount": -10.5, "date": "2026-11-03T00:00:00.000Z",
            "type": "DEBIT", "status": "POSTED"}
    return {**base, **kw}


def test_tipo_conta():
    assert tipo_conta({"type": "BANK", "subtype": "CHECKING_ACCOUNT"}) == "CORRENTE"
    assert tipo_conta({"type": "BANK", "subtype": "SAVINGS_ACCOUNT"}) == "POUPANCA"
    assert tipo_conta({"type": "CREDIT", "subtype": "CREDIT_CARD"}) == "CARTAO_CREDITO"
    assert tipo_conta({"type": "OUTRO"}) is None


def test_data_pura_nao_recua_um_dia():
    assert _data_transacao("2026-11-03T00:00:00.000Z") == date(2026, 11, 3)


def test_data_com_horario_converte_para_brasilia():
    assert _data_transacao("2026-11-04T01:30:00.000Z") == date(2026, 11, 3)  # 22h30 do dia 3 em Brasilia


def test_conta_corrente_saida_e_entrada():
    s = normalizar_transacao(tx(), "CORRENTE")
    assert (s["direcao"], s["valor"]) == ("SAIDA", Decimal("10.50"))
    e = normalizar_transacao(tx(amount=1500, type="CREDIT"), "CORRENTE")
    assert (e["direcao"], e["valor"]) == ("ENTRADA", Decimal("1500.00"))


def test_pix_e_debito():
    assert normalizar_transacao(tx(operationType="PIX"), "CORRENTE")["metodo"] == "PIX"
    assert normalizar_transacao(tx(paymentData={"paymentMethod": "PIX"}), "CORRENTE")["metodo"] == "PIX"
    assert normalizar_transacao(tx(description="COMPRA CARTAO DEBITO MERCADO"), "CORRENTE")["metodo"] == "DEBITO"
    assert normalizar_transacao(tx(description="Tarifa"), "CORRENTE")["metodo"] == "OUTRO"


def test_cartao_compra_pagamento_e_parcela():
    compra = normalizar_transacao(
        tx(amount=75, type="DEBIT", creditCardMetadata={"installmentNumber": 2, "totalInstallments": 6}),
        "CARTAO_CREDITO")
    assert (compra["direcao"], compra["metodo"], compra["parcela_atual"], compra["total_parcelas"]) == ("SAIDA", "CREDITO", 2, 6)
    assert compra["ignorar_no_fluxo"] is False
    pagamento = normalizar_transacao(tx(amount=-150, type="CREDIT", operationType="PAGAMENTO_FATURA"), "CARTAO_CREDITO")
    assert pagamento["direcao"] == "ENTRADA" and pagamento["ignorar_no_fluxo"] is True


def test_pagamento_de_fatura_na_conta_corrente_fica_fora_do_fluxo():
    t = normalizar_transacao(tx(description="PAGAMENTO FATURA CARTÃO"), "CORRENTE")
    assert t["ignorar_no_fluxo"] is True


def test_pendente_e_valor_zero():
    assert normalizar_transacao(tx(status="PENDING"), "CORRENTE")["status"] == "PENDENTE"
    assert normalizar_transacao(tx(amount=0), "CORRENTE") is None
