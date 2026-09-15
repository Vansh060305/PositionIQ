# Thin route - real work happens in navigator_service.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.navigator import NavigatorOverviewOut
from services import navigator_service

router = APIRouter(prefix="/navigator", tags=["navigator"])


@router.get("/overview", response_model=NavigatorOverviewOut)
def navigator_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ranks the user's open positions by attention required - decision
    # support only, never executes trades.
    return navigator_service.get_navigator_overview(db, current_user)