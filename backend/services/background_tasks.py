# Runs on a timer for as long as the app is up. Every interval, it re-checks
# every connected user's OPEN positions and pushes a fresh decision over
# their WebSocket - this is what makes positions "watch themselves" instead
# of only updating when someone clicks "Run analysis".
#
# The tick logic is split into its own function (run_broadcast_tick) so it
# can be tested directly, without waiting for the real interval to pass.

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from core.database import SessionLocal
from models.user import User
from models.position import Position, PositionStatus
from services.connection_manager import manager
from services import decision_service, digest_service

logger = logging.getLogger(__name__)

BROADCAST_INTERVAL_SECONDS = 60
DIGEST_INTERVAL_SECONDS = 24 * 60 * 60  # once a day


def build_live_payload(position, decision) -> dict:
    """The message pushed for one live update.

    Carries the fresh market data + score straight from the just-created
    health snapshot (the tick already fetched a new Finnhub quote, so the
    payload needs no extra API calls) plus an ISO timestamp so the frontend
    can update prices/P&L/signals without a REST round trip and knows when
    the update was generated.
    """
    snapshot = decision.snapshot
    return {
        "type": "decision_update",
        "position_id": str(position.id),
        "action": decision.action.value,
        "confidence": decision.confidence,
        "health_score": snapshot.health_score,
        "current_price": snapshot.current_price,
        "pnl_percent": snapshot.pnl_percent,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def run_broadcast_tick():
    # One full pass: for every connected user, recalculate their open
    # positions and push the result. Each user gets ONE Finnhub call per
    # open position per tick - fine at demo scale, worth watching at larger scale.
    for user_id in manager.connected_user_ids():
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
            if not user:
                continue

            positions = (
                db.query(Position)
                .filter(Position.user_id == user.id, Position.status == PositionStatus.OPEN)
                .all()
            )

            for position in positions:
                try:
                    decision, alerts = decision_service.generate_decision(db, user, position.id)
                    await manager.send_to_user(user_id, build_live_payload(position, decision))
                    for alert in alerts:
                        await manager.send_to_user(
                            user_id,
                            {
                                "type": "alert",
                                "position_id": str(position.id),
                                "alert_type": alert.type.value,
                                "message": alert.message,
                            },
                        )
                except Exception as e:
                    # One bad symbol or a rate limit hit shouldn't stop the
                    # rest of the user's positions from updating
                    logger.warning(f"Broadcast failed for position {position.id}: {e}")
        finally:
            db.close()


async def broadcast_loop():
    while True:
        await asyncio.sleep(BROADCAST_INTERVAL_SECONDS)
        await run_broadcast_tick()


async def run_digest_tick():
    # One pass: send every active user their daily digest email
    db = SessionLocal()
    try:
        users = db.query(User).filter(User.is_active.is_(True)).all()
        for user in users:
            try:
                digest_service.send_daily_digest(db, user)
            except Exception as e:
                logger.warning(f"Digest failed for user {user.id}: {e}")
    finally:
        db.close()


async def digest_loop():
    while True:
        await asyncio.sleep(DIGEST_INTERVAL_SECONDS)
        await run_digest_tick()
