import uuid
import enum

from sqlalchemy import Column, Text, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.database import Base


class AlertType(str, enum.Enum):
    HEALTH_DROP = "HEALTH_DROP"
    STOP_NEAR = "STOP_NEAR"
    TARGET_NEAR = "TARGET_NEAR"
    DIGEST = "DIGEST"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    position_id = Column(UUID(as_uuid=True), ForeignKey("positions.id"), nullable=True, index=True)

    type = Column(Enum(AlertType), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
