# Thin route - real work happens in assistant_service.py

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.assistant import AssistantAskRequest, AssistantResponse
from services import assistant_service

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask", response_model=AssistantResponse)
def assistant_ask(
    payload: AssistantAskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Decision-support AI assistant: answers questions about the user's own
    # PositionIQ data with real context. Never executes trades, never writes.
    result = assistant_service.ask(db, current_user, payload.question)
    return AssistantResponse(**result)