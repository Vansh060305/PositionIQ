# Ties together: generate a fresh health snapshot -> run the rule-based
# decision engine on it -> save the Decision, linked to that snapshot ->
# check whether that snapshot deserves an in-app alert. Gemini explanation
# is a SEPARATE, on-demand step (explain_decision below) - kept out of the
# main generate flow so the core analysis loop stays fast and doesn't burn
# Gemini quota on every automatic WebSocket refresh.

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from models.decision import Decision
from models.user import User
from services import decision_engine, health_service, alert_service, gemini_service
from services.position_service import get_position  # ownership check


def generate_decision(db: Session, user: User, position_id):
    snapshot = health_service.generate_health_snapshot(db, user, position_id)
    position = snapshot.position  # ORM relationship - no extra ownership query needed

    action, confidence = decision_engine.decide_action(
        health_score=snapshot.health_score,
        pnl_percent=snapshot.pnl_percent,
        distance_to_stop=snapshot.distance_to_stop,
        distance_to_target=snapshot.distance_to_target,
        volatility_percent=snapshot.volatility or 0.0,
        trend=snapshot.trend.value if snapshot.trend else "SIDEWAYS",
    )

    decision = Decision(
        position_id=snapshot.position_id,
        snapshot_id=snapshot.id,
        action=action,
        confidence=confidence,
        explanation=None,  # filled in by Gemini in Phase 12
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    alerts = alert_service.check_and_create_alerts(db, position, snapshot)

    return decision, alerts


def get_latest_decision(db: Session, user: User, position_id) -> Decision | None:
    position = get_position(db, user, position_id)  # ownership check first
    return (
        db.query(Decision)
        .filter(Decision.position_id == position.id)
        .order_by(Decision.created_at.desc())
        .first()
    )


def explain_decision(db: Session, user: User, position_id) -> Decision:
    # Fills in the plain-English explanation for the LATEST decision -
    # never generates a new decision, and never changes the action itself.
    decision = get_latest_decision(db, user, position_id)
    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No decision to explain yet - run an analysis first",
        )

    explanation = gemini_service.explain_decision(decision.position, decision.snapshot, decision)
    decision.explanation = explanation
    db.commit()
    db.refresh(decision)
    return decision


def ask_doctor(db: Session, user: User, position_id, question: str) -> str:
    position = get_position(db, user, position_id)  # ownership check
    decision = get_latest_decision(db, user, position_id)  # may be None - that's fine
    snapshot = decision.snapshot if decision else None
    return gemini_service.ask_doctor(position, snapshot, decision, question)
