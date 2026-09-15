# These classes define exactly what the API accepts (Create/Update) and
# what it sends back (Out). Keeping this separate from the DB model means
# we control what fields the frontend can set vs just read.

import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field

from models.position import PositionType, PositionStatus


class PositionCreate(BaseModel):
    symbol: str
    exchange: str
    sector: Optional[str] = None          # used later for portfolio analytics (Phase 8)
    entry_price: float = Field(gt=0)      # gt=0 rejects zero/negative prices at the door
    quantity: int = Field(gt=0)
    stop_loss: Optional[float] = None
    target: Optional[float] = None
    position_type: PositionType = PositionType.LONG


class PositionUpdate(BaseModel):
    # Every field optional - user only sends what they actually want to change.
    # extra="forbid" makes the API REJECT unknown fields (e.g. status) with a
    # 422 instead of silently ignoring them.
    # NOTE: status deliberately has no field here - closing a position must go
    # through POST /positions/{id}/close, which computes exit_price and
    # realized_pnl; a bare PATCH could otherwise create CLOSED rows with no
    # exit data that would break trade history.
    model_config = ConfigDict(extra="forbid")

    stop_loss: Optional[float] = None
    target: Optional[float] = None
    quantity: Optional[int] = None


class ClosePositionRequest(BaseModel):
    exit_price: float = Field(gt=0)


class PositionOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    symbol: str
    exchange: str
    sector: Optional[str]
    entry_price: float
    quantity: int
    stop_loss: Optional[float]
    target: Optional[float]
    position_type: PositionType
    status: PositionStatus
    exit_price: Optional[float]
    realized_pnl: Optional[float]
    closed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True   # lets this read straight from a SQLAlchemy object
