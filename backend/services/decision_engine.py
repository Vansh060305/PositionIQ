# Rule-based Decision Engine. Takes the Health Engine's output (Phase 6)
# and picks ONE action + a confidence score. This is fully deterministic -
# same inputs always give the same decision, no randomness, no AI/ML.
# Gemini (Phase 11) only EXPLAINS this decision in plain English later -
# it is never allowed to make the decision itself.
#
# Rules are checked top-to-bottom in priority order. The first matching
# rule wins and we return immediately - most urgent/severe case first.

from models.decision import ActionType


def decide_action(
    health_score: float,
    pnl_percent: float,
    distance_to_stop,
    distance_to_target,
    volatility_percent: float,
    trend: str,
) -> tuple[ActionType, float]:
    # Returns (action, confidence) where confidence is 0.0-1.0

    # Rule 1 (most urgent): stop-loss has already been breached
    if distance_to_stop is not None and distance_to_stop <= 0:
        return ActionType.EXIT, 0.95

    # Rule 2: target has already been reached or passed - lock in the win
    if distance_to_target is not None and distance_to_target <= 0:
        return ActionType.BOOK_PROFIT, 0.9

    # Rule 3: position is overall unhealthy - better to exit before it worsens
    if health_score < 30:
        return ActionType.EXIT, 0.85

    # Rule 4: dangerously close to the stop-loss (within 3% buffer) - tighten it
    if distance_to_stop is not None and 0 < distance_to_stop <= 3:
        return ActionType.TIGHTEN_STOP, 0.8

    # Rule 5: mediocre health - cut exposure instead of holding full size
    if health_score < 50:
        return ActionType.REDUCE, 0.7

    # Rule 6: strong profit and very close to target - book it now
    if pnl_percent > 15 and distance_to_target is not None and 0 < distance_to_target <= 5:
        return ActionType.BOOK_PROFIT, 0.75

    # Rule 7: choppy/volatile stock while health isn't great - hedge the risk
    if volatility_percent > 8 and health_score < 70:
        return ActionType.HEDGE, 0.65

    # Rule 8: sitting in profit but the trend just turned down - protect gains
    if trend == "DOWN" and pnl_percent > 0:
        return ActionType.TIGHTEN_STOP, 0.6

    # Default: nothing urgent, the position looks fine as it is
    return ActionType.HOLD, 0.6
