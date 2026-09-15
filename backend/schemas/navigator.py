# Shape of the Trade Navigator response sent to the frontend.

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class NavigatorPositionOut(BaseModel):
    position_id: uuid.UUID  # lets the frontend link straight to the Position Detail page
    symbol: str
    attention_score: Optional[float]  # 0-100, higher = needs more attention
    # Exactly one of HIGH ATTENTION / WATCH / HEALTHY when analysis ran;
    # None when no live (or previously stored) market data exists at all.
    attention_tier: Optional[str]
    current_price: Optional[float]
    health_score: Optional[float]
    current_action: Optional[str]  # raw action value: HOLD/BOOK_PROFIT/TIGHTEN_STOP/REDUCE/HEDGE/EXIT
    driving_factors: List[str]  # human-readable reasons behind the ranking
    primary_reason: Optional[str]  # the single most important factor
    next_thing_to_watch: Optional[str]  # concrete, deterministic guidance


class NavigatorOverviewOut(BaseModel):
    positions: List[NavigatorPositionOut]
    generated_at: datetime