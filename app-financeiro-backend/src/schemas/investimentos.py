from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

class InvestimentoBase(BaseModel):
    ticker: str = Field(..., description="Código do ativo (ex: TRXF11)")
    categoria: str = Field(..., description="FII, ACAO, ou ETF")
    quantidade: float = Field(..., ge=0, description="Quantidade de cotas/ações")
    preco_medio: float = Field(..., ge=0, description="Preço médio de compra")
    percentual_alvo: float = Field(0.0, ge=0, le=100, description="Meta percentual na carteira")

    @field_validator('ticker')
    @classmethod
    def formatar_ticker(cls, v: str) -> str:
        return v.strip().upper()
        
    @field_validator('categoria')
    @classmethod
    def formatar_categoria(cls, v: str) -> str:
        return v.strip().upper()

class InvestimentoCreate(InvestimentoBase):
    pass

class InvestimentoUpdate(BaseModel):
    quantidade: Optional[float] = Field(None, ge=0)
    preco_medio: Optional[float] = Field(None, ge=0)
    percentual_alvo: Optional[float] = Field(None, ge=0, le=100)

class InvestimentoResponse(BaseModel):
    id: str
    ticker: str
    categoria: str
    quantidade: float
    preco_medio: float
    percentual_alvo: float
    cotacao_atual: Optional[float] = None
    ultima_atualizacao: Optional[datetime] = None