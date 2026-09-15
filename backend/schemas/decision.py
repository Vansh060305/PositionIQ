# Shape of a position decision sent back to the frontend.

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from models.decision import ActionType


class DecisionOut(BaseModel):
    id: uuid.UUID
    position_id: uuid.UUID
    snapshot_id: uuid.UUID
    action: ActionType
    confidence: Optional[float]
    explanation: Optional[str]  # None until Phase 11 (Gemini) fills it in
    created_at: datetime

    class Config:
        from_attributes = True
