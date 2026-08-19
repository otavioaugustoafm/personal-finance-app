from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime

class TransacaoCreate(BaseModel):
    ticker: str = Field(..., description="Código do ativo (ex: TRXF11)")
    categoria: str = Field(..., description="FII, ACAO, ou ETF")
    tipo: str = Field(..., description="COMPRA ou VENDA")
    quantidade: float = Field(..., gt=0, description="Quantidade da boleta")
    preco_unitario: float = Field(..., gt=0, description="Preço pago ou vendido")
    percentual_alvo: float = Field(0.0, ge=0, le=100, description="Meta percentual na carteira")

    @field_validator('ticker')
    @classmethod
    def formatar_ticker(cls, v: str) -> str:
        return v.strip().upper()
        
    @field_validator('categoria', 'tipo')
    @classmethod
    def formatar_maiusculas(cls, v: str) -> str:
        return v.strip().upper()

class InvestimentoResponse(BaseModel):
    id: str
    ticker: str
    categoria: str
    quantidade: float
    preco_medio: float
    percentual_alvo: float
    cotacao_atual: Optional[float] = None
    ultima_atualizacao: Optional[datetime] = None

class MetaUpdate(BaseModel):
    percentual_alvo: float = Field(..., ge=0, le=100, description="Nova meta percentual na carteira")