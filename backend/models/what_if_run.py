import uuid

from sqlalchemy import Column, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.database import Base


class WhatIfRun(Base):
    __tablename__ = "what_if_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    simulated_price = Column(Float, nullable=False)
    simulated_result = Column(JSON, nullable=True)  # {health_score, decision, pnl}

    created_at = Column(DateTime(timezone=True), server_default=func.now())
