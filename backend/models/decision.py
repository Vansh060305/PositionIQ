import uuid
import enum

from sqlalchemy import Column, Float, Text, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from core.database import Base


class ActionType(str, enum.Enum):
    HOLD = "HOLD"
    BOOK_PROFIT = "BOOK_PROFIT"
    TIGHTEN_STOP = "TIGHTEN_STOP"
    REDUCE = "REDUCE"
    HEDGE = "HEDGE"
    EXIT = "EXIT"


class Decision(Base):
    __tablename__ = "decisions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"), nullable=False, index=True)
    snapshot_id = Column(UUID(as_uuid=True), ForeignKey("health_snapshots.id"), nullable=False, unique=True)

    action = Column(Enum(ActionType), nullable=False)
    confidence = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)  # Gemini-generated, filled in Phase 12

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    position = relationship("Position", back_populates="decisions")
    snapshot = relationship("HealthSnapshot", back_populates="decision")
