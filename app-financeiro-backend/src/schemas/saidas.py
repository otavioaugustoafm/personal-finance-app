from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class SaidaCreate(BaseModel):
    descricao: str = Field(..., min_length=3)
    valor: float = Field(..., gt=0)
    tipo_saida: str = Field(..., pattern="^(FIXA|PONTUAL)$")
    data_vencimento: date
    regra_recorrencia: str = Field(..., pattern="^(ULTIMO_DIA_UTIL|DIA_FIXO|DATA_EXATA)$")
    pago: Optional[bool] = False
    is_reembolsavel: Optional[bool] = False  # NOVO: Para gastos da mãe/amigos
    forma_pagamento: str = Field(default="DEBITO", pattern="^(DEBITO|CREDITO|PIX|BOLETO)$") # NOVO

class SaidaUpdate(BaseModel):
    descricao: Optional[str] = Field(None, min_length=3)
    valor: Optional[float] = Field(None, gt=0)
    tipo_saida: Optional[str] = Field(None, pattern="^(FIXA|PONTUAL)$")
    data_vencimento: Optional[date] = None
    regra_recorrencia: Optional[str] = Field(None, pattern="^(ULTIMO_DIA_UTIL|DIA_FIXO|DATA_EXATA)$")
    pago: Optional[bool] = None
    is_reembolsavel: Optional[bool] = None
    forma_pagamento: Optional[str] = Field(None, pattern="^(DEBITO|CREDITO|PIX|BOLETO)$")