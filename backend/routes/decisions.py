# Thin routes - real work happens in decision_service.py

import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from schemas.decision import DecisionOut
from schemas.gemini import AIAssistantRequest, AIAssistantResponse
from services import decision_service

router = APIRouter(prefix="/decisions", tags=["decisions"])


@router.post("/{position_id}/generate", response_model=DecisionOut, status_code=status.HTTP_201_CREATED)
def generate_decision(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Runs a fresh health check, then decides HOLD/BOOK_PROFIT/EXIT/etc.
    # (alerts, if any, are created as a side effect and surfaced via /alerts)
    decision, _alerts = decision_service.generate_decision(db, current_user, position_id)
    return decision


@router.get("/{position_id}/latest", response_model=DecisionOut)
def latest_decision(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    decision = decision_service.get_latest_decision(db, current_user, position_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No decision generated yet for this position",
        )
    return decision


@router.post("/{position_id}/explain", response_model=DecisionOut)
def explain_decision(
    position_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Fills in a plain-English explanation for the latest decision via Gemini
    return decision_service.explain_decision(db, current_user, position_id)


@router.post("/{position_id}/ask", response_model=AIAssistantResponse)
def ask_doctor(
    position_id: uuid.UUID,
    payload: AIAssistantRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    answer = decision_service.ask_doctor(db, current_user, position_id, payload.question)
    return AIAssistantResponse(answer=answer)
