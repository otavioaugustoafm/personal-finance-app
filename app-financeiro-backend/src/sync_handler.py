"""Ponto de entrada da Lambda agendada (EventBridge), uma vez por dia."""
from src.sync import sincronizar


def handler(event, context):
    resultado = sincronizar()
    if resultado["status"] == "ERRO":
        # Faz a execucao aparecer como falha no CloudWatch
        raise RuntimeError("Sincronizacao falhou: " + "; ".join(resultado["erros"]))
    return resultado
