# Thin route - real work happens in portfolio_service.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.portfolio import PortfolioSummaryOut
from services import portfolio_service

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("/summary", response_model=PortfolioSummaryOut)
def portfolio_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return portfolio_service.get_portfolio_summary(db, current_user)
