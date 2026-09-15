# Ties together position_service (ownership + DB), market_data (Finnhub),
# and position_engine (pure math) into one flow: fetch -> calculate -> save.
# Kept separate from position_engine.py so the math stays testable without a DB.

from sqlalchemy.orm import Session

from models.health_snapshot import HealthSnapshot
from models.user import User
from services import market_data, position_engine
from services.position_service import get_position  # reuses the ownership check


def generate_health_snapshot(db: Session, user: User, position_id) -> HealthSnapshot:
    position = get_position(db, user, position_id)  # raises 404/403 if not allowed
    quote = market_data.get_quote(position.symbol)
    snapshot_data = position_engine.build_health_snapshot(position, quote)

    snapshot = HealthSnapshot(position_id=position.id, **snapshot_data)
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def get_health_history(db: Session, user: User, position_id) -> list[HealthSnapshot]:
    position = get_position(db, user, position_id)  # ownership check first
    return (
        db.query(HealthSnapshot)
        .filter(HealthSnapshot.position_id == position.id)
        .order_by(HealthSnapshot.created_at.desc())
        .all()
    )
