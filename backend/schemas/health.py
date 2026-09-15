# Shape of a health snapshot sent back to the frontend.

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from models.health_snapshot import Trend


class HealthSnapshotOut(BaseModel):
    id: uuid.UUID
    position_id: uuid.UUID
    health_score: float
    current_price: float
    pnl_percent: float
    distance_to_stop: Optional[float]
    distance_to_target: Optional[float]
    volatility: Optional[float]
    trend: Optional[Trend]
    created_at: datetime

    class Config:
        from_attributes = True
