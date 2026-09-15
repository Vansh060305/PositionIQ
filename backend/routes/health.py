# Thin routes - real work happens in health_service.py

import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.health import HealthSnapshotOut
from services import health_service

router = APIRouter(prefix="/health", tags=["health"])


@router.post("/{position_id}/calculate", response_model=HealthSnapshotOut, status_code=status.HTTP_201_CREATED)
def calculate_health(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Pulls a fresh price, runs the scoring formula, and saves a new snapshot
    return health_service.generate_health_snapshot(db, current_user, position_id)


@router.get("/{position_id}/history", response_model=list[HealthSnapshotOut])
def health_history(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return health_service.get_health_history(db, current_user, position_id)
