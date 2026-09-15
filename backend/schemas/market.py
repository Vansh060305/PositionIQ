# Defines exactly what the /market/quote endpoint sends back to the frontend.

from typing import Optional
from pydantic import BaseModel


class QuoteOut(BaseModel):
    symbol: str
    current_price: Optional[float]
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    previous_close: Optional[float]
    change: Optional[float]
    percent_change: Optional[float]
