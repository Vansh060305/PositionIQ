import uuid
import enum

from sqlalchemy import Column, Float, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from core.database import Base


class Trend(str, enum.Enum):
    UP = "UP"
    DOWN = "DOWN"
    SIDEWAYS = "SIDEWAYS"


class HealthSnapshot(Base):
    __tablename__ = "health_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"), nullable=False, index=True)

    health_score = Column(Float, nullable=False)  # 0-100
    current_price = Column(Float, nullable=False)
    pnl_percent = Column(Float, nullable=False)
    distance_to_stop = Column(Float, nullable=True)
    distance_to_target = Column(Float, nullable=True)
    volatility = Column(Float, nullable=True)
    trend = Column(Enum(Trend), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    position = relationship("Position", back_populates="health_snapshots")
    decision = relationship("Decision", back_populates="snapshot", uselist=False)
