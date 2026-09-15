# Thin route - real work happens in pulse_service.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.pulse import PulseOverviewOut
from services import pulse_service

router = APIRouter(prefix="/pulse", tags=["pulse"])


@router.get("/overview", response_model=PulseOverviewOut)
def pulse_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Read-only holdings market pulse - deterministic, real data only,
    # scoped to the user's own open positions.
    return pulse_service.get_pulse_overview(db, current_user)