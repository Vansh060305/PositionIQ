# All position business logic lives here, not in the route file.
# Routes just call these functions and return whatever they give back.

import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models.position import Position, PositionType, PositionStatus
from models.alert import Alert
from models.user import User, UserRole
from models.what_if_run import WhatIfRun
from schemas.position import PositionCreate, PositionUpdate
from services import subscription_service


def create_position(db: Session, user: User, payload: PositionCreate) -> Position:
    subscription_service.enforce_position_limit(db, user)  # blocks an 11th open position on Free

    # Position always belongs to the logged-in user - we never trust a
    # user_id sent in the request body, only the token identifies the owner.
    position = Position(user_id=user.id, **payload.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def list_positions(db: Session, user: User, status_filter: PositionStatus | None = None) -> list[Position]:
    # ANALYST/ADMIN can see everyone's positions (needed for their role),
    # a plain USER only ever sees their own.
    query = db.query(Position)
    if user.role == UserRole.USER:
        query = query.filter(Position.user_id == user.id)
    if status_filter is not None:
        query = query.filter(Position.status == status_filter)
    return query.order_by(Position.created_at.desc()).all()


def get_position(db: Session, user: User, position_id: uuid.UUID) -> Position:
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
    _check_ownership(user, position)
    return position


def update_position(db: Session, user: User, position_id: uuid.UUID, payload: PositionUpdate) -> Position:
    position = get_position(db, user, position_id)  # reuses ownership check above

    # exclude_unset=True means: only touch fields the user actually sent
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(position, field, value)

    db.commit()
    db.refresh(position)
    return position


def close_position(db: Session, user: User, position_id: uuid.UUID, exit_price: float) -> Position:
    position = get_position(db, user, position_id)  # ownership check first

    if position.status != PositionStatus.OPEN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only an open position can be closed",
        )

    # Same P&L direction logic as the health engine - LONG profits when
    # price rises, SHORT profits when price falls.
    if position.position_type == PositionType.LONG:
        realized_pnl = (exit_price - position.entry_price) * position.quantity
    else:
        realized_pnl = (position.entry_price - exit_price) * position.quantity

    position.exit_price = exit_price
    position.realized_pnl = round(realized_pnl, 2)
    position.status = PositionStatus.CLOSED
    position.closed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(position)
    return position


def delete_position(db: Session, user: User, position_id: uuid.UUID) -> None:
    position = get_position(db, user, position_id)  # reuses ownership check above

    # Position's ORM relationships only cascade health_snapshots and
    # decisions. Child rows that sit in OTHER tables would leave dangling
    # foreign keys and blow up the DELETE with a 500 - clear them first.
    db.query(WhatIfRun).filter(WhatIfRun.position_id == position.id).delete(synchronize_session=False)
    db.query(Alert).filter(Alert.position_id == position.id).delete(synchronize_session=False)
    db.delete(position)
    db.commit()


def _check_ownership(user: User, position: Position) -> None:
    # A regular USER is blocked from touching someone else's position.
    # ANALYST/ADMIN are allowed through (they need visibility across users).
    if user.role == UserRole.USER and position.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your position")
