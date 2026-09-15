"""
Market Pulse - a truthful, read-only view of the user's holdings condition.

Every number here is derived from REAL data only:
  - fresh Finnhub quotes (the existing market_data service),
  - the existing deterministic health engine (position_engine),
  - the existing portfolio service (exposure / diversification),
  - last real stored snapshots when a live quote fails (never invented prices).

Scope is deliberately limited to the user's own holdings. The current Finnhub
integration is quote-level only, so market-wide breadth, index benchmarks,
volume, and historical trend are NOT fabricated here - when such data does not
exist, the pulse simply says so.

Pulse status is a deterministic 0-100 score decomposed into four explainable
components (no Gemini, no ML, no randomness):

  health points  (0-50)  exposure-weighted average health score / 100 * 50
  breadth points (0-25)  share of positions in profit * 25
  day points     (0-15)  live day-change breadth (0 all down ... 15 all up)
  volatility     (0-10)  penalty for wide intraday ranges: 10 - avg_vol*1.5

  >= 65 -> POSITIVE, 45-64 -> NEUTRAL, 25-44 -> CAUTION, < 25 -> NEGATIVE

Nothing is persisted here and no trades are executed.
"""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.health_snapshot import HealthSnapshot
from models.position import Position, PositionStatus
from models.user import User, UserRole
from services import market_data, portfolio_service, position_engine

logger = logging.getLogger(__name__)

MARKET_SCOPE = "Your Holdings Market Pulse"

POSITIVE = "POSITIVE"
NEUTRAL = "NEUTRAL"
CAUTION = "CAUTION"
NEGATIVE = "NEGATIVE"

# Small dead zone so genuinely negligible moves are FLAT, not UP/DOWN -
# matches the trend dead-zone convention used elsewhere in the app.
_DEAD_ZONE = 0.2

_HEADLINES = {
    POSITIVE: "Your open holdings look positive right now",
    NEUTRAL: "Your open holdings look steady - no strong trend either way",
    CAUTION: "Parts of your holdings need attention",
    NEGATIVE: "Your open holdings are under pressure",
}


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _day_trend_from(percent_change) -> str | None:
    if percent_change is None:
        return None
    if percent_change > _DEAD_ZONE:
        return "UP"
    if percent_change < -_DEAD_ZONE:
        return "DOWN"
    return "SIDEWAYS"


def _pnl_bucket(pnl_percent) -> str:
    # "up" / "down" / "flat" - direction-aware because pnl_percent already
    # accounts for LONG vs SHORT.
    if pnl_percent > _DEAD_ZONE:
        return "up"
    if pnl_percent < -_DEAD_ZONE:
        return "down"
    return "flat"


def _fallback_to_last_snapshot(db: Session, position: Position):
    """Last REAL stored snapshot for a position - used when the live quote
    fails so we never invent a price. Returns (snapshot_data, True) or
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
        "volatility": snapshot.volatility or 0.0,
        "trend": snapshot.trend,
    }, True


def _no_data_entry(position: Position) -> dict:
    # No live quote AND no stored snapshot: list the position transparently
    # with null data instead of silently dropping it (and never fake a price).
    return {
        "position_id": position.id,
        "symbol": position.symbol,
        "position_type": position.position_type.value,
        "quantity": position.quantity,
        "current_price": None,
        "change": None,
        "percent_change": None,
        "day_trend": None,
        "pnl_percent": None,
        "health_score": None,
        "volatility": None,
        "data_source": "NONE",
    }


def _analyze_position(db: Session, position: Position) -> dict:
    """One position -> compact market info. A single failure never breaks the
    whole pulse (falls back to the last real snapshot, then to a NONE entry)."""
    try:
        quote = market_data.get_quote(position.symbol)
        snapshot = position_engine.build_health_snapshot(position, quote)
        return {
            "position_id": position.id,
            "symbol": position.symbol,
            "position_type": position.position_type.value,
            "quantity": position.quantity,
            "current_price": snapshot["current_price"],
            "change": quote.get("change"),
            "percent_change": quote.get("percent_change"),
            "day_trend": _day_trend_from(quote.get("percent_change")),
            "pnl_percent": snapshot["pnl_percent"],
            "health_score": snapshot["health_score"],
            "volatility": snapshot["volatility"],
            "data_source": "LIVE",
        }
    except HTTPException as exc:
        logger.warning(f"Pulse: live quote failed for {position.symbol}: {exc.detail}")
    except Exception as exc:  # defensive - never break the whole response
        logger.warning(f"Pulse: unexpected failure for {position.symbol}: {exc}")

    snapshot, _stale = _fallback_to_last_snapshot(db, position)
    if snapshot is None:
        return _no_data_entry(position)
    return {
        "position_id": position.id,
        "symbol": position.symbol,
        "position_type": position.position_type.value,
        "quantity": position.quantity,
        "current_price": snapshot["current_price"],
        "change": None,  # day change is not reliable from a stored snapshot
        "percent_change": None,
        "day_trend": snapshot["trend"].value if snapshot["trend"] else None,
        "pnl_percent": snapshot["pnl_percent"],
        "health_score": snapshot["health_score"],
        "volatility": snapshot["volatility"],
        "data_source": "STALE",
    }


def _pulse_score(
    exposure_weighted_health,
    share_in_profit,
    live_up_share,
    live_down_share,
    avg_volatility,
) -> float:
    health_points = (exposure_weighted_health or 0) / 100 * 50
    breadth_points = (share_in_profit or 0) * 25
    if live_up_share is not None:
        day_points = (1 + (live_up_share - live_down_share)) / 2 * 15
    else:
        day_points = 0.0  # no live quotes -> no day-change credit
    if avg_volatility is not None:
        vol_points = _clamp(10 - avg_volatility * 1.5, 0, 10)
    else:
        vol_points = 5.0  # unknown volatility -> neutral
    return round(health_points + breadth_points + day_points + vol_points, 2)


def _status_for(score: float) -> str:
    if score >= 65:
        return POSITIVE
    if score >= 45:
        return NEUTRAL
    if score >= 25:
        return CAUTION
    return NEGATIVE


def _plural(n: int, singular: str, plural: str) -> str:
    return singular if n == 1 else plural


def _build_reasons(
    entries, up, down, flat, unknown,
    up_today, down_today, flat_today,
    avg_health, weighted_health, avg_vol,
    total_exposure, diversification_score, sector_count,
) -> list[str]:
    reasons: list[str] = []
    with_data = up + down + flat
    if with_data:
        reasons.append(f"{up} of {with_data} open positions are in profit")
        if down:
            reasons.append(f"{down} of {with_data} open positions are showing a loss")
        if flat:
            reasons.append(f"{flat} positions are roughly flat right now")
        if up_today:
            reasons.append(
                f"{up_today} {_plural(up_today, 'symbol is', 'symbols are')} up today"
            )
        if down_today:
            reasons.append(
                f"{down_today} {_plural(down_today, 'symbol is', 'symbols are')} down today"
            )
        if up_today == 0 and down_today == 0 and flat_today and not unknown:
            reasons.append("Today's trading is flat across your symbols")
        if avg_health is not None:
            reasons.append(f"Average position health is {avg_health:.1f}/100")
        if weighted_health is not None:
            reasons.append(f"Exposure-weighted health is {weighted_health:.1f}/100")
        if avg_vol is not None:
            reasons.append(f"Average intraday volatility is {avg_vol:.1f}%")
        if sector_count:
            reasons.append(
                f"Holdings are {diversification_score:.0f}% diversified across "
                f"{sector_count} {_plural(sector_count, 'sector', 'sectors')}"
            )
        reasons.append(f"Total holdings exposure is ${total_exposure:,.2f} (cost basis)")
    else:
        reasons.append(
            "Live market data is currently unavailable - the pulse cannot be computed"
        )

    stale = sum(1 for e in entries if e["data_source"] == "STALE")
    no_data = sum(1 for e in entries if e["data_source"] == "NONE")
    if stale:
        reasons.append(f"Live quotes unavailable for {stale} position(s) - using last known market data")
    if no_data:
        reasons.append(f"No market data available for {no_data} position(s)")
    return reasons


def get_pulse_overview(db: Session, user: User) -> dict:
    # Same visibility rule as everywhere else in the app: a plain USER sees
    # only their own positions, ANALYST/ADMIN see everyone's.
    query = db.query(Position).filter(Position.status == PositionStatus.OPEN)
    if user.role == UserRole.USER:
        query = query.filter(Position.user_id == user.id)
    positions = query.all()

    generated_at = datetime.now(timezone.utc)

    if not positions:
        return {
            "market_scope": MARKET_SCOPE,
            "pulse_status": None,
            "headline": "No open positions to analyze",
            "reasons": ["Add an open position to see your holdings market pulse"],
            "total_open_positions": 0,
            "positions_up": 0,
            "positions_down": 0,
            "positions_flat": 0,
            "positions_unknown": 0,
            "symbols_up_today": 0,
            "symbols_down_today": 0,
            "symbols_flat_today": 0,
            "avg_health_score": None,
            "exposure_weighted_health": None,
            "avg_volatility": None,
            "total_exposure": 0.0,
            "diversification_score": 0.0,
            "positions": [],
            "generated_at": generated_at,
        }

    entries = [_analyze_position(db, p) for p in positions]
    entries.sort(key=lambda e: (e["symbol"].upper(), str(e["position_id"])))

    # Breadth - P&L direction (LONG/SHORT aware) over positions with data.
    buckets = [_pnl_bucket(e["pnl_percent"]) for e in entries if e["pnl_percent"] is not None]
    up = buckets.count("up")
    down = buckets.count("down")
    flat = buckets.count("flat")
    unknown = sum(1 for e in entries if e["pnl_percent"] is None)

    # Day-change breadth - LIVE quotes only, never stale data.
    live_trends = [_day_trend_from(e["percent_change"]) for e in entries if e["data_source"] == "LIVE"]
    live_trends = [t for t in live_trends if t is not None]
    up_today = live_trends.count("UP")
    down_today = live_trends.count("DOWN")
    flat_today = live_trends.count("SIDEWAYS")

    # Health aggregates across every position with any data (live or stored).
    healths = [e["health_score"] for e in entries if e["health_score"] is not None]
    avg_health = round(sum(healths) / len(healths), 2) if healths else None

    exposure_by_id = {p.id: p.entry_price * p.quantity for p in positions}
    weighted_numerator = sum(
        e["health_score"] * exposure_by_id[e["position_id"]]
        for e in entries
        if e["health_score"] is not None
    )
    weighted_denominator = sum(
        exposure_by_id[e["position_id"]] for e in entries if e["health_score"] is not None
    )
    exposure_weighted_health = (
        round(weighted_numerator / weighted_denominator, 2) if weighted_denominator else None
    )

    # Volatility - mean intraday high-low range % across positions with data.
    # LIVE entries carry the fresh quote's range; STALE entries carry the last
    # real stored range. Both are real data - never invented.
    vols = [e["volatility"] for e in entries if e.get("volatility") is not None]
    avg_volatility = round(sum(vols) / len(vols), 2) if vols else None

    # Exposure / diversification from the existing portfolio service (cost
    # basis weights - no extra Finnhub calls, consistent with the dashboard).
    portfolio = portfolio_service.get_portfolio_summary(db, user)
    total_exposure = portfolio["total_exposure"]
    diversification_score = portfolio["diversification_score"]
    sector_count = len(portfolio["sector_breakdown"])

    with_data = up + down + flat
    share_in_profit = up / with_data if with_data else None
    if live_trends:
        live_up_share = up_today / len(live_trends)
        live_down_share = down_today / len(live_trends)
    else:
        live_up_share = live_down_share = None

    score = _pulse_score(
        exposure_weighted_health,
        share_in_profit,
        live_up_share,
        live_down_share,
        avg_volatility,
    )

    if with_data == 0:
        pulse_status = None
        headline = "Live market data is currently unavailable"
    else:
        pulse_status = _status_for(score)
        headline = _HEADLINES[pulse_status]

    reasons = _build_reasons(
        entries, up, down, flat, unknown,
        up_today, down_today, flat_today,
        avg_health, exposure_weighted_health, avg_volatility,
        total_exposure, diversification_score, sector_count,
    )

    return {
        "market_scope": MARKET_SCOPE,
        "pulse_status": pulse_status,
        "headline": headline,
        "reasons": reasons,
        "total_open_positions": len(positions),
        "positions_up": up,
        "positions_down": down,
        "positions_flat": flat,
        "positions_unknown": unknown,
        "symbols_up_today": up_today,
        "symbols_down_today": down_today,
        "symbols_flat_today": flat_today,
        "avg_health_score": avg_health,
        "exposure_weighted_health": exposure_weighted_health,
        "avg_volatility": avg_volatility,
        "total_exposure": total_exposure,
        "diversification_score": diversification_score,
        "positions": entries,
        "generated_at": generated_at,
    }