# Thin routes - each one just pulls the logged-in user + DB session
# and hands the real work to position_service.

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from models.position import PositionStatus
from schemas.position import PositionCreate, PositionUpdate, PositionOut, ClosePositionRequest
from services import position_service

router = APIRouter(prefix="/positions", tags=["positions"])


@router.post("", response_model=PositionOut, status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return position_service.create_position(db, current_user, payload)


@router.get("", response_model=list[PositionOut])
def list_positions(
    status_filter: Optional[PositionStatus] = Query(None, alias="status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ?status=OPEN or ?status=CLOSED - omit to get everything (used by
    # the Dashboard for open positions and Trade History for closed ones)
    return position_service.list_positions(db, current_user, status_filter)


@router.get("/{position_id}", response_model=PositionOut)
def get_position(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return position_service.get_position(db, current_user, position_id)


@router.patch("/{position_id}", response_model=PositionOut)
def update_position(
    position_id: uuid.UUID,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return position_service.update_position(db, current_user, position_id, payload)


@router.post("/{position_id}/close", response_model=PositionOut)
def close_position(
    position_id: uuid.UUID,
    payload: ClosePositionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Records the exit price, computes realized P&L, marks CLOSED -
    # this is what feeds the Trade History page.
    return position_service.close_position(db, current_user, position_id, payload.exit_price)


@router.delete("/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    position_service.delete_position(db, current_user, position_id)
