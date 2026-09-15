# This file only does MATH - no database, no network calls. That's on purpose:
# it makes the core "analysis" logic trivial to unit test and to explain in
# an interview ("the scoring formula is pure functions, fully deterministic").

from models.position import Position, PositionType
from models.health_snapshot import Trend


def _clamp(value: float, low: float, high: float) -> float:
    # Keeps a number inside a min/max range - used everywhere below
    # so no individual score can go negative or exceed its max points
    return max(low, min(high, value))


def calculate_pnl_percent(position: Position, current_price: float) -> float:
    # % gain/loss - formula flips for SHORT positions (they profit when price falls)
    if position.position_type == PositionType.LONG:
        return (current_price - position.entry_price) / position.entry_price * 100
    return (position.entry_price - current_price) / position.entry_price * 100


def calculate_distance_to_stop(position: Position, current_price: float):
    # % buffer left before the stop-loss is hit. Negative = already breached.
    if position.stop_loss is None:
        return None
    if position.position_type == PositionType.LONG:
        return (current_price - position.stop_loss) / current_price * 100
    return (position.stop_loss - current_price) / current_price * 100


def calculate_distance_to_target(position: Position, current_price: float):
    # % still left to reach the target. Zero or negative = target reached/passed.
    if position.target is None:
        return None
    if position.position_type == PositionType.LONG:
        return (position.target - current_price) / current_price * 100
    return (current_price - position.target) / current_price * 100


def calculate_volatility(quote: dict) -> float:
    # Simple proxy for volatility: today's high-low range as a % of price.
    # A production system would use historical price series - kept simple
    # here so Phase 6 doesn't need extra paid API calls.
    current = quote.get("current_price") or 0
    high = quote.get("high")
    low = quote.get("low")
    if not current or high is None or low is None:
        return 0.0
    return (high - low) / current * 100


def calculate_trend(quote: dict) -> Trend:
    # Compares today's price to yesterday's close, with a small dead-zone
    # so tiny fluctuations don't get labeled UP/DOWN
    current = quote.get("current_price")
    previous = quote.get("previous_close")
    if not current or not previous:
        return Trend.SIDEWAYS
    change_percent = (current - previous) / previous * 100
    if change_percent > 0.2:
        return Trend.UP
    if change_percent < -0.2:
        return Trend.DOWN
    return Trend.SIDEWAYS


def calculate_health_score(
    pnl_percent: float,
    distance_to_stop,
    distance_to_target,
    volatility_percent: float,
) -> float:
    # Weighted 0-100 score, split across 4 factors:
    #   40 pts - P&L performance
    #   30 pts - buffer left before stop-loss is hit
    #   15 pts - how close/beyond the position is to its target
    #   15 pts - volatility penalty (a calmer stock scores higher)

    # 1. P&L: -20% or worse = 0 pts, +20% or better = full 40 pts
    pnl_score = _clamp((pnl_percent + 20) / 40 * 40, 0, 40)

    # 2. Stop-loss buffer: no stop set = neutral half-credit,
    #    already breached = 0, 10%+ buffer = full 30 pts
    if distance_to_stop is None:
        stop_score = 15.0
    elif distance_to_stop <= 0:
        stop_score = 0.0
    else:
        stop_score = _clamp(distance_to_stop / 10 * 30, 0, 30)

    # 3. Target proximity: no target set = neutral half-credit,
    #    reached/passed = full 15 pts, otherwise scales up within a 20% window
    if distance_to_target is None:
        target_score = 7.5
    elif distance_to_target <= 0:
        target_score = 15.0
    else:
        target_score = _clamp(15 * (1 - distance_to_target / 20), 0, 15)

    # 4. Volatility: every 1% of daily price range removes 3 pts, capped at 15
    volatility_score = _clamp(15 - volatility_percent * 3, 0, 15)

    return round(pnl_score + stop_score + target_score + volatility_score, 2)


def build_health_snapshot(position: Position, quote: dict) -> dict:
    # Runs every calculation above and packages the result, ready to be
    # saved as a HealthSnapshot row by health_service.py
    current_price = quote["current_price"]

    pnl_percent = calculate_pnl_percent(position, current_price)
    distance_to_stop = calculate_distance_to_stop(position, current_price)
    distance_to_target = calculate_distance_to_target(position, current_price)
    volatility = calculate_volatility(quote)
    trend = calculate_trend(quote)

    health_score = calculate_health_score(
        pnl_percent, distance_to_stop, distance_to_target, volatility
    )

    return {
        "health_score": health_score,
        "current_price": current_price,
        "pnl_percent": round(pnl_percent, 2),
        "distance_to_stop": round(distance_to_stop, 2) if distance_to_stop is not None else None,
        "distance_to_target": round(distance_to_target, 2) if distance_to_target is not None else None,
        "volatility": round(volatility, 2),
        "trend": trend,
    }
