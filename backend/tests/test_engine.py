"""
Pure-function tests for position_engine.py (scoring math) and
decision_engine.py (rule engine) - no DB, no network, no FastAPI needed.
"""

from services import position_engine, decision_engine
from models.position import Position, PositionType
from models.decision import ActionType
from models.health_snapshot import Trend


def test_long_position_pnl_percent():
    pos = Position(entry_price=100, position_type=PositionType.LONG)
    assert position_engine.calculate_pnl_percent(pos, 120) == 20.0


def test_short_position_profits_when_price_falls():
    pos = Position(entry_price=100, position_type=PositionType.SHORT)
    assert position_engine.calculate_pnl_percent(pos, 90) == 10.0


def test_distance_to_stop_negative_when_breached():
    pos = Position(entry_price=100, stop_loss=90, position_type=PositionType.LONG)
    assert position_engine.calculate_distance_to_stop(pos, 85) < 0


def test_distance_to_stop_none_when_no_stop_set():
    pos = Position(entry_price=100, stop_loss=None, position_type=PositionType.LONG)
    assert position_engine.calculate_distance_to_stop(pos, 105) is None


def test_health_score_high_for_strong_position():
    score = position_engine.calculate_health_score(
        pnl_percent=20, distance_to_stop=25, distance_to_target=8, volatility_percent=1.0
    )
    assert score > 70


def test_health_score_low_for_breached_stop():
    score = position_engine.calculate_health_score(
        pnl_percent=-15, distance_to_stop=-5, distance_to_target=100, volatility_percent=1.0
    )
    assert score < 30


def test_trend_detection():
    assert position_engine.calculate_trend({"current_price": 105, "previous_close": 100}) == Trend.UP
    assert position_engine.calculate_trend({"current_price": 95, "previous_close": 100}) == Trend.DOWN
    assert (
        position_engine.calculate_trend({"current_price": 100.05, "previous_close": 100})
        == Trend.SIDEWAYS
    )


def test_decision_exit_when_stop_breached():
    action, confidence = decision_engine.decide_action(
        health_score=40, pnl_percent=-5, distance_to_stop=-2,
        distance_to_target=10, volatility_percent=2, trend="DOWN",
    )
    assert action == ActionType.EXIT
    assert confidence == 0.95


def test_decision_book_profit_when_target_reached():
    action, _ = decision_engine.decide_action(
        health_score=80, pnl_percent=20, distance_to_stop=20,
        distance_to_target=-1, volatility_percent=2, trend="UP",
    )
    assert action == ActionType.BOOK_PROFIT


def test_decision_hold_when_nothing_urgent():
    action, _ = decision_engine.decide_action(
        health_score=80, pnl_percent=3, distance_to_stop=15,
        distance_to_target=15, volatility_percent=2, trend="UP",
    )
    assert action == ActionType.HOLD


def test_decision_reduce_on_mediocre_health():
    action, _ = decision_engine.decide_action(
        health_score=45, pnl_percent=1, distance_to_stop=8,
        distance_to_target=10, volatility_percent=2, trend="SIDEWAYS",
    )
    assert action == ActionType.REDUCE
