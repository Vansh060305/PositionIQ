# Given a hypothetical price, computes what the health score, P&L, and
# recommended action WOULD be - reuses the same pure math from
# position_engine.py and the same rules from decision_engine.py, so a
# simulation and a real analysis are always calculated identically.
#
# Deliberately does NOT call Finnhub (the price is hypothetical, not live)
# and does NOT save a real HealthSnapshot/Decision - those represent actual
# diagnoses, a "what if" is just a guess. The run itself is logged to
# what_if_runs for history.

from sqlalchemy.orm import Session

from models.what_if_run import WhatIfRun
from models.user import User
from services import position_engine, decision_engine
from services.position_service import get_position


def run_simulation(db: Session, user: User, position_id, simulated_price: float) -> dict:
    position = get_position(db, user, position_id)  # ownership check

    pnl_percent = position_engine.calculate_pnl_percent(position, simulated_price)
    distance_to_stop = position_engine.calculate_distance_to_stop(position, simulated_price)
    distance_to_target = position_engine.calculate_distance_to_target(position, simulated_price)

    # There's no live quote for a hypothetical price, so volatility and
    # trend can't actually be measured - neutral defaults are used rather
    # than pretending to know them.
    volatility_percent = 0.0
    trend = "SIDEWAYS"

    health_score = position_engine.calculate_health_score(
        pnl_percent, distance_to_stop, distance_to_target, volatility_percent
    )

    action, confidence = decision_engine.decide_action(
        health_score=health_score,
        pnl_percent=pnl_percent,
        distance_to_stop=distance_to_stop,
        distance_to_target=distance_to_target,
        volatility_percent=volatility_percent,
        trend=trend,
    )

    result = {
        "simulated_price": simulated_price,
        "health_score": health_score,
        "pnl_percent": round(pnl_percent, 2),
        "distance_to_stop": round(distance_to_stop, 2) if distance_to_stop is not None else None,
        "distance_to_target": round(distance_to_target, 2) if distance_to_target is not None else None,
        "predicted_action": action.value,
    }

    run = WhatIfRun(
        position_id=position.id,
        user_id=user.id,
        simulated_price=simulated_price,
        simulated_result=result,
    )
    db.add(run)
    db.commit()

    return result
