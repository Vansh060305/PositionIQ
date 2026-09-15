# Owns the "what plan is this user on, and what does that unlock" logic.
# PRO is activated through the one-click PRO Demo flow - no payment involved.
# The plan lives in a real Subscription row, so it persists across refresh,
# logout/login and new sessions exactly like the old paid flow.

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.subscription import Subscription, PlanType, SubscriptionStatus
from models.position import Position, PositionStatus
from models.user import User

FREE_PLAN_POSITION_LIMIT = 10


def get_active_subscription(db: Session, user: User) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user.id, Subscription.status == SubscriptionStatus.ACTIVE)
        .order_by(Subscription.started_at.desc())
        .first()
    )


def get_plan(db: Session, user: User) -> str:
    sub = get_active_subscription(db, user)
    if sub and sub.plan == PlanType.PRO:
        expires_at = sub.expires_at
        if expires_at is not None:
            # Some DB drivers return a naive datetime even when the column
            # is timezone-aware - treat a naive value as UTC rather than
            # crashing on the comparison below.
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                return PlanType.FREE.value  # expired - silently treat as free, no crash
        return PlanType.PRO.value
    return PlanType.FREE.value


def enforce_position_limit(db: Session, user: User) -> None:
    if get_plan(db, user) == PlanType.PRO.value:
        return  # unlimited on PRO

    open_count = (
        db.query(Position)
        .filter(Position.user_id == user.id, Position.status == PositionStatus.OPEN)
        .count()
    )
    if open_count >= FREE_PLAN_POSITION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Free plan is limited to {FREE_PLAN_POSITION_LIMIT} open positions. Upgrade to PRO for unlimited.",
        )


def activate_pro_demo(db: Session, user: User) -> Subscription:
    # One-click PRO Demo activation - no payment. Idempotent: if PRO is
    # already active for this user, return the existing subscription instead
    # of creating duplicates or extending anything.
    existing = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.plan == PlanType.PRO,
            Subscription.status == SubscriptionStatus.ACTIVE,
        )
        .order_by(Subscription.started_at.desc())
        .first()
    )
    if existing:
        return existing

    now = datetime.now(timezone.utc)
    subscription = Subscription(
        user_id=user.id,
        plan=PlanType.PRO,
        status=SubscriptionStatus.ACTIVE,
        started_at=now,
        expires_at=None,  # permanent - a demo activation never expires
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription