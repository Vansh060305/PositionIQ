from typing import Optional
from pydantic import BaseModel, Field


class SimulateRequest(BaseModel):
    simulated_price: float = Field(gt=0)


class SimulateResponse(BaseModel):
    simulated_price: float
    health_score: float
    pnl_percent: float
    distance_to_stop: Optional[float]
    distance_to_target: Optional[float]
    predicted_action: str
