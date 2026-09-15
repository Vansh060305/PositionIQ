import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.simulator import SimulateRequest, SimulateResponse
from services import simulator_service

router = APIRouter(prefix="/simulator", tags=["simulator"])


@router.post("/{position_id}", response_model=SimulateResponse)
def simulate(
    position_id: uuid.UUID,
    payload: SimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return simulator_service.run_simulation(db, current_user, position_id, payload.simulated_price)
