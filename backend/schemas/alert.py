import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from models.alert import AlertType


class AlertOut(BaseModel):
    id: uuid.UUID
    position_id: Optional[uuid.UUID]
    type: AlertType
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
