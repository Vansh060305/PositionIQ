from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.payment import SubscriptionOut, SubscriptionStatusOut
from services import subscription_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.post("/activate-pro-demo", response_model=SubscriptionOut)
def activate_pro_demo(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # One-click PRO Demo activation - no payment involved. Writes a real
    # (permanent) PRO subscription row so the plan persists across refresh,
    # logout/login and new sessions.
    return subscription_service.activate_pro_demo(db, current_user)


@router.get("/subscription", response_model=SubscriptionStatusOut)
def get_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    plan = subscription_service.get_plan(db, current_user)
    sub = subscription_service.get_active_subscription(db, current_user)
    return SubscriptionStatusOut(plan=plan, expires_at=sub.expires_at if sub else None)