"""
Trade Navigator - decision-support ranking of a user's OPEN positions.

For every open position it fetches a fresh Finnhub quote (the existing
market_data service), recomputes the existing deterministic health engine
(position_engine) and rule-based decision engine (decision_engine), and turns
those signals into a single "how much attention does this need right now?"
score + an explainable tier (HIGH ATTENTION / WATCH / HEALTHY).

It is strictly read-only decision support:
  - nothing is persisted here,
  - no orders are placed,
  - Gemini/ML has no part in the ranking,
  - same inputs always produce the same output.

Market-data safety: if a symbol's live quote fails, we fall back to the last
REAL snapshot stored for that position (no invented prices). If there is no
snapshot at all, the position is still listed with a clear "no data" marker
instead of silently disappearing - but never with a fake price.
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.decision import ActionType, Decision
from models.health_snapshot import HealthSnapshot
from models.position import Position, PositionStatus
from models.user import User, UserRole
from services import decision_engine, market_data, position_engine

logger = logging.getLogger(__name__)

HIGH_TIER = "HIGH ATTENTION"
WATCH_TIER = "WATCH"
HEALTHY_TIER = "HEALTHY"

# How many attention points each decision action is worth (0-30).
# Mirrors the urgency order in decision_engine.py: EXIT is the most urgent,
# HOLD the least.
_ACTION_SEVERITY = {
    ActionType.HOLD: 0,
    ActionType.HEDGE: 12,
    ActionType.REDUCE: 16,
    ActionType.TIGHTEN_STOP: 20,
    ActionType.BOOK_PROFIT: 24,
    ActionType.EXIT: 30,
}

_ACTION_LABELS = {
    ActionType.HOLD: "HOLD",
    ActionType.HEDGE: "HEDGE",
    ActionType.REDUCE: "REDUCE",
    ActionType.TIGHTEN_STOP: "TIGHTEN STOP",
    ActionType.BOOK_PROFIT: "BOOK PROFIT",
    ActionType.EXIT: "EXIT",
}


# ---------------------------------------------------------------------------
# Attention scoring - every component is deterministic and explainable.
# ---------------------------------------------------------------------------


def _health_attention(health_score: float) -> tuple[float, str | None]:
    # Up to 45 points from the position-score deficit (0/100 -> 45, 100/100 -> 0)
    deficit = (100 - health_score) * 0.45
    if health_score < 30:
        return deficit, f"Position score {health_score:.1f}/100 is critically low"
    if health_score < 50:
        return deficit, f"Position score {health_score:.1f}/100 is below the healthy range"
    return deficit, None


def _stop_attention(distance_to_stop) -> tuple[float, str | None]:
    # Up to 15 points - a breached stop is the single most urgent signal.
    if distance_to_stop is None:
        return 4.0, "No stop loss is set - downside is undefined"
    if distance_to_stop <= 0:
        return 15.0, "Price has breached the stop loss"
    if distance_to_stop <= 3:
        return 12.0, f"Stop loss is only {distance_to_stop:.1f}% away"
    if distance_to_stop <= 5:
        return 8.0, f"Stop loss is {distance_to_stop:.1f}% away"
    if distance_to_stop <= 10:
        return 4.0, f"Stop loss is {distance_to_stop:.1f}% away"
    return 0.0, None


def _target_attention(distance_to_target) -> tuple[float, str | None]:
    # Up to 10 points - a reached target demands a "book or let it run" call.
    if distance_to_target is None:
        return 1.0, None
    if distance_to_target <= 0:
        return 10.0, "Target has been reached or passed"
    if distance_to_target <= 5:
        return 6.0, f"Target is {distance_to_target:.1f}% away"
    if distance_to_target <= 10:
        return 3.0, f"Target is {distance_to_target:.1f}% away"
    return 0.0, None


def _attention_score(
    health_score: float, action: ActionType, distance_to_stop, distance_to_target
) -> float:
    # 0-100: position-score deficit (45) + action severity (30) +
    # stop proximity (15) + target proximity (10)
    health, _ = _health_attention(health_score)
    stop, _ = _stop_attention(distance_to_stop)
    target, _ = _target_attention(distance_to_target)
    return round(health + _ACTION_SEVERITY[action] + stop + target, 2)


def _tier_for(score: float) -> str:
    if score >= 60:
        return HIGH_TIER
    if score >= 30:
        return WATCH_TIER
    return HEALTHY_TIER


# ---------------------------------------------------------------------------
# Human-readable explanations (deterministic strings, no Gemini)
# ---------------------------------------------------------------------------


def _primary_reason(
    action: ActionType, health_score, distance_to_stop, distance_to_target, stale: bool
) -> str:
    if stale:
        return "Live quote unavailable - using the last known market data for this position"
    if distance_to_stop is not None and distance_to_stop <= 0:
        return "Price is at or below the stop-loss level - this position needs an immediate decision"
    if health_score < 30:
        return "Position score is critically low - risk of further deterioration is high"
    if distance_to_target is not None and distance_to_target <= 0:
        return "Target has been reached - decide whether to book the profit now"
    if action == ActionType.EXIT:
        return "The decision engine recommends EXIT - check the stop-loss level now"
    if action == ActionType.TIGHTEN_STOP:
        return "The decision engine recommends TIGHTEN STOP - price is close to the stop loss"
    if action == ActionType.BOOK_PROFIT:
        return "Target conditions triggered BOOK PROFIT - decide whether to lock in the gain"
    if action == ActionType.REDUCE:
        return "The decision engine recommends REDUCE - trim exposure while risk is elevated"
    if action == ActionType.HEDGE:
        return "The decision engine recommends HEDGE - volatility is elevated"
    return "The decision engine recommends HOLD - no urgent action needed"


def _next_thing_to_watch(action: ActionType, distance_to_stop, distance_to_target) -> str:
    if distance_to_stop is not None and distance_to_stop <= 0:
        return "Confirm the exit: watch whether price stays below the stop loss before acting"
    if distance_to_target is not None and distance_to_target <= 0:
        return "Watch price vs target - book the profit if momentum stalls or price pulls back"
    if action == ActionType.EXIT:
        return "Watch the stop-loss level - exit if price does not recover quickly"
    if action == ActionType.TIGHTEN_STOP:
        return "Watch the stop-loss buffer - tighten the stop as price moves in your favor"
    if action == ActionType.BOOK_PROFIT:
        return "Watch price against target - book the profit if it stalls near the target"
    if action == ActionType.REDUCE:
        return "Watch the position score - reduce size if it stays below 50"
    if action == ActionType.HEDGE:
        return "Watch volatility - consider hedging or reducing if swings keep widening"
    return "Watch price vs stop and target for any change from the current plan"


# ---------------------------------------------------------------------------
# Per-position analysis
# ---------------------------------------------------------------------------


def _decide_action_from(db: Session, position: Position, snapshot_data: dict, stale: bool) -> ActionType:
    # Fresh snapshot -> run the rule-based engine. Stale snapshot -> prefer
    # the last decision we already persisted (it was made on real data), and
    # only recompute if no decision exists yet.
    if stale:
        decision = (
            db.query(Decision)
            .filter(Decision.position_id == position.id)
            .order_by(Decision.created_at.desc())
            .first()
        )
        if decision is not None:
            return decision.action

    action, _confidence = decision_engine.decide_action(
        health_score=snapshot_data["health_score"],
        pnl_percent=snapshot_data["pnl_percent"],
        distance_to_stop=snapshot_data["distance_to_stop"],
        distance_to_target=snapshot_data["distance_to_target"],
        volatility_percent=snapshot_data.get("volatility") or 0.0,
        trend=snapshot_data["trend"].value if snapshot_data["trend"] else "SIDEWAYS",
    )
    return action


def _fallback_to_last_snapshot(db: Session, position: Position):
    """Last REAL stored snapshot for a position - used when the live quote
    fails, so we never invent a price. Returns (snapshot_data, stale) or
    (None, False) when the position has no history at all."""
    snapshot = (
        db.query(HealthSnapshot)
        .filter(HealthSnapshot.position_id == position.id)
        .order_by(HealthSnapshot.created_at.desc())
        .first()
    )
    if snapshot is None:
        return None, False
    return {
        "health_score": snapshot.health_score,
        "current_price": snapshot.current_price,
        "pnl_percent": snapshot.pnl_percent,
        "distance_to_stop": snapshot.distance_to_stop,
        "distance_to_target": snapshot.distance_to_target,
        "volatility": snapshot.volatility,
        "trend": snapshot.trend,
    }, True


def _no_data_entry(position: Position) -> dict:
    # No live quote AND no stored snapshot: list the position transparently
    # with null data instead of silently dropping it (and never fake a price).
    return {
        "position_id": position.id,
        "symbol": position.symbol,
        "attention_score": None,
        "attention_tier": None,
        "current_price": None,
        "health_score": None,
        "current_action": None,
        "driving_factors": [
            f"No live market data available for {position.symbol} right now"
        ],
        "primary_reason": "Market data is temporarily unavailable - no analysis could be run",
        "next_thing_to_watch": "Retry once live market data is available for this symbol",
    }


def _build_entry(position: Position, snapshot_data: dict, action: ActionType, stale: bool) -> dict:
    health_score = snapshot_data["health_score"]
    distance_to_stop = snapshot_data["distance_to_stop"]
    distance_to_target = snapshot_data["distance_to_target"]

    driving_factors: list[str] = []
    if stale:
        driving_factors.append("Live quote unavailable - showing the last known market data")
    health_factor = _health_attention(health_score)[1]
    stop_factor = _stop_attention(distance_to_stop)[1]
    target_factor = _target_attention(distance_to_target)[1]
    if health_factor:
        driving_factors.append(health_factor)
    if stop_factor:
        driving_factors.append(stop_factor)
    if target_factor:
        driving_factors.append(target_factor)
    driving_factors.append(f"Current action: {_ACTION_LABELS[action]}")

    score = _attention_score(health_score, action, distance_to_stop, distance_to_target)

    return {
        "position_id": position.id,
        "symbol": position.symbol,
        "attention_score": score,
        "attention_tier": _tier_for(score),
        "current_price": snapshot_data["current_price"],
        "health_score": health_score,
        "current_action": action.value,
        "driving_factors": driving_factors,
        "primary_reason": _primary_reason(
            action, health_score, distance_to_stop, distance_to_target, stale
        ),
        "next_thing_to_watch": _next_thing_to_watch(
            action, distance_to_stop, distance_to_target
        ),
    }


def _analyze_position(db: Session, position: Position) -> dict:
    # Fresh quote first. Any failure (Finnhub down, rate limit, unknown
    # symbol) falls back to real stored data - and a single failing symbol
    # can never 500 the whole Navigator response.
    snapshot_data = None
    stale = False
    try:
        quote = market_data.get_quote(position.symbol)
        snapshot_data = position_engine.build_health_snapshot(position, quote)
    except HTTPException as exc:
        snapshot_data, stale = _fallback_to_last_snapshot(db, position)
        if snapshot_data is None:
            logger.warning(f"Navigator: no data for {position.symbol}: {exc.detail}")
            return _no_data_entry(position)
    except Exception as exc:  # defensive - never break the whole response
        logger.warning(f"Navigator: unexpected failure for {position.symbol}: {exc}")
        snapshot_data, stale = _fallback_to_last_snapshot(db, position)
        if snapshot_data is None:
            return _no_data_entry(position)

    action = _decide_action_from(db, position, snapshot_data, stale)
    return _build_entry(position, snapshot_data, action, stale)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------


def get_navigator_overview(db: Session, user: User) -> dict:
    # Same visibility rule as everywhere else in the app: a plain USER sees
    # only their own positions, ANALYST/ADMIN see everyone's.
    query = db.query(Position).filter(Position.status == PositionStatus.OPEN)
    if user.role == UserRole.USER:
        query = query.filter(Position.user_id == user.id)
    positions = query.all()

    rows = [_analyze_position(db, position) for position in positions]

    # Rank: most attention first. Entries with no data go last. Tie-breaks
    # (lower score first, then symbol) keep the order fully deterministic.
    rows.sort(
        key=lambda r: (
            r["attention_score"] is None,  # None last
            -(r["attention_score"] or 0),  # highest score first
            r["health_score"] if r["health_score"] is not None else float("inf"),
            r["symbol"].upper(),
        )
    )

    return {
        "positions": rows,
        "generated_at": datetime.now(timezone.utc),
    }