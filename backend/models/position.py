import uuid
import enum

from sqlalchemy import Column, String, Float, Integer, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from core.database import Base


class PositionType(str, enum.Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class PositionStatus(str, enum.Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    EXITED = "EXITED"


class Position(Base):
    __tablename__ = "positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    symbol = Column(String, nullable=False)
    exchange = Column(String, nullable=False)
    sector = Column(String, nullable=True)  # used by Phase 8 portfolio analytics

    entry_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False)
    stop_loss = Column(Float, nullable=True)
    target = Column(Float, nullable=True)

    position_type = Column(Enum(PositionType), nullable=False, default=PositionType.LONG)
    status = Column(Enum(PositionStatus), nullable=False, default=PositionStatus.OPEN)

    # Filled in only when the position is closed - lets Trade History show
    # what actually happened without recomputing from live prices later.
    exit_price = Column(Float, nullable=True)
    realized_pnl = Column(Float, nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    health_snapshots = relationship(
        "HealthSnapshot", back_populates="position", cascade="all, delete-orphan"
    )
    decisions = relationship(
        "Decision", back_populates="position", cascade="all, delete-orphan"
    )
