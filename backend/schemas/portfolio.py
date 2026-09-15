# Shape of the portfolio summary sent back to the frontend dashboard.

from typing import List
from pydantic import BaseModel


class SectorExposure(BaseModel):
    sector: str
    exposure: float
    percent: float


class PortfolioSummaryOut(BaseModel):
    total_exposure: float
    sector_breakdown: List[SectorExposure]
    diversification_score: float  # 0 = all one sector, 100 = perfectly spread out
    position_count: int
