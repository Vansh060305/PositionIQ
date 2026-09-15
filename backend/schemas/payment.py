import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from models.subscription import PlanType, SubscriptionStatus


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    plan: PlanType
    status: SubscriptionStatus
    started_at: datetime
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class SubscriptionStatusOut(BaseModel):
    plan: str
    expires_at: Optional[datetime]