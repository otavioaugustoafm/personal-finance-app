from pydantic import BaseModel, Field
from datetime import date
from typing import Optional

class EntradaCreate(BaseModel):
    descricao: str = Field(..., min_length=3, description="Ex: Salário, Freelance")
    valor: float = Field(..., gt=0, description="Deve ser um valor positivo")
    tipo_entrada: str = Field(..., pattern="^(FIXA|PONTUAL)$")
    data_recebimento: date
    regra_recorrencia: str = Field(..., pattern="^(ULTIMO_DIA_UTIL|DIA_FIXO|DATA_EXATA)$")
    confirmada: Optional[bool] = False

class EntradaUpdate(BaseModel):
    descricao: Optional[str] = Field(None, min_length=3)
    valor: Optional[float] = Field(None, gt=0)
    tipo_entrada: Optional[str] = Field(None, pattern="^(FIXA|PONTUAL)$")
    data_recebimento: Optional[date] = None
    regra_recorrencia: Optional[str] = Field(None, pattern="^(ULTIMO_DIA_UTIL|DIA_FIXO|DATA_EXATA)$")
    confirmada: Optional[bool] = None