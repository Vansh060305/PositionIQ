import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    action = Column(String, nullable=False)  # e.g. "position.created", "auth.login"
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    extra_data = Column(JSON, nullable=True)  # named extra_data - "metadata" is reserved by SQLAlchemy

    created_at = Column(DateTime(timezone=True), server_default=func.now())
