"""
Trade Navigator backend tests.

The Navigator ranks a user's OPEN positions by how much attention they need,
using only real (or last-stored) market data and the existing deterministic
health/decision engines. Quotes are deterministic doubles - no network, no
Finnhub - so ranking, tiers, and ordering are fully predictable.
"""

import uuid

import pytest
from fastapi import HTTPException

from models.decision import ActionType
from services import navigator_service


def _register_and_login(client, email=None):
    email = email or f"nav-{uuid.uuid4().hex[:10]}@example.com"
    password = "pass1234"
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def _create_position(client, headers, symbol="AAPL", **overrides):
    payload = {
        "symbol": symbol,
        "exchange": "NASDAQ",
        "entry_price": 200,
        "quantity": 10,
        "stop_loss": 190,
        "target": 230,
        "position_type": "LONG",
    }
    payload.update(overrides)
    r = client.post("/positions", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _quote(symbol, price, prev_close=None):
    """Deterministic Finnhub-style quote. High/low = +-2% -> volatility 4%,
    prev_close defaults to price -> trend SIDEWAYS."""
    pc = price - 0.5 if prev_close is None else prev_close
    return {
        "symbol": symbol.upper(),
        "current_price": price,
        "open": price - 1,
        "high": round(price * 1.02, 4),
        "low": round(price * 0.98, 4),
        "previous_close": pc,
        "change": price - pc,
        "percent_change": round((price - pc) / pc * 100, 4) if pc else 0,
    }


def _overview(client, headers):
    r = client.get("/navigator/overview", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_normal_long_position_is_healthy(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=190, target=230)

    body = _overview(client, headers)
    assert len(body["positions"]) == 1
    row = body["positions"][0]
    assert row["symbol"] == "AAPL"
    assert row["current_price"] == 215
    assert row["current_action"] == "HOLD"
    assert row["attention_tier"] == "HEALTHY"
    assert 0 <= row["attention_score"] <= 100
    assert row["health_score"] == pytest.approx(70.27, abs=0.5)
    assert row["primary_reason"] == "The decision engine recommends HOLD - no urgent action needed"
    assert isinstance(row["driving_factors"], list) and row["driving_factors"]
    assert row["next_thing_to_watch"]


def test_normal_short_position_is_healthy(client, auth_headers, monkeypatch):
    # SHORT: entry 300, stop 330 (above entry for a short), target 250.
    # Price 280 = profitable short sitting between target and stop.
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 280))
    headers = auth_headers()
    _create_position(
        client, headers, symbol="TSLA", entry_price=300, quantity=5,
        stop_loss=330, target=250, position_type="SHORT",
    )

    row = _overview(client, headers)["positions"][0]
    assert row["symbol"] == "TSLA"
    assert row["current_price"] == 280
    assert row["current_action"] == "HOLD"
    assert row["attention_tier"] == "HEALTHY"
    assert row["health_score"] == pytest.approx(66.6, abs=0.5)


def test_stop_loss_breach_is_high_attention(client, auth_headers, monkeypatch):
    # LONG entry 300, stop 295; price 290 = stop breached -> EXIT, top attention.
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 290))
    headers = auth_headers()
    _create_position(client, headers, symbol="NFLX", entry_price=300, stop_loss=295, target=350)

    row = _overview(client, headers)["positions"][0]
    assert row["current_action"] == "EXIT"
    assert row["attention_tier"] == "HIGH ATTENTION"
    assert row["attention_score"] >= 60
    assert any("breached the stop loss" in f for f in row["driving_factors"])
    assert "immediate decision" in row["primary_reason"]
    assert "below the stop loss" in row["next_thing_to_watch"]


def test_stop_loss_proximity_without_breach_raises_attention(client, auth_headers, monkeypatch):
    # Stop only ~1.1% away, not yet breached -> TIGHTEN_STOP, still high attention.
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 200.3))
    headers = auth_headers()
    _create_position(client, headers, symbol="GOOG", entry_price=200, stop_loss=198, target=230)

    row = _overview(client, headers)["positions"][0]
    assert row["current_action"] == "TIGHTEN_STOP"
    assert any("Stop loss is only" in f for f in row["driving_factors"])
    # Score is >= 60 (position-score deficit + tight stop) so the tier must
    # not be HEALTHY - the position genuinely needs attention.
    assert row["attention_tier"] != "HEALTHY"


def test_target_reached_triggers_book_profit_watch(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 211))
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=180, target=210)

    row = _overview(client, headers)["positions"][0]
    assert row["current_action"] == "BOOK_PROFIT"
    assert row["attention_tier"] == "WATCH"
    assert any("Target has been reached" in f for f in row["driving_factors"])


def test_different_health_scores_and_actions(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),   # strong -> HOLD
        "MSFT": _quote("MSFT", 183),   # mediocre -> REDUCE
        "NFLX": _quote("NFLX", 290),   # broken -> EXIT
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, stop_loss=175, target=200)
    _create_position(client, headers, symbol="NFLX", entry_price=300, stop_loss=295, target=350)

    rows = _overview(client, headers)["positions"]
    actions = {r["symbol"]: r["current_action"] for r in rows}
    assert actions["AAPL"] == "HOLD"
    assert actions["MSFT"] == "REDUCE"
    assert actions["NFLX"] == "EXIT"
    scores = {r["symbol"]: r["health_score"] for r in rows}
    assert len(set(scores.values())) == 3  # genuinely different health scores


def test_tier_classification_covers_all_three_tiers(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),   # HEALTHY
        "MSFT": _quote("MSFT", 183),   # WATCH
        "NFLX": _quote("NFLX", 290),   # HIGH ATTENTION
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, stop_loss=175, target=200)
    _create_position(client, headers, symbol="NFLX", entry_price=300, stop_loss=295, target=350)

    tiers = {r["symbol"]: r["attention_tier"] for r in _overview(client, headers)["positions"]}
    assert tiers["AAPL"] == "HEALTHY"
    assert tiers["MSFT"] == "WATCH"
    assert tiers["NFLX"] == "HIGH ATTENTION"


def test_ranking_puts_most_attention_first(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),
        "MSFT": _quote("MSFT", 183),
        "NFLX": _quote("NFLX", 290),
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, stop_loss=175, target=200)
    _create_position(client, headers, symbol="NFLX", entry_price=300, stop_loss=295, target=350)

    rows = _overview(client, headers)["positions"]
    assert [r["symbol"] for r in rows] == ["NFLX", "MSFT", "AAPL"]
    assert rows[0]["attention_score"] >= rows[1]["attention_score"] >= rows[2]["attention_score"]


def test_empty_open_portfolio_returns_empty_list(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    headers = auth_headers()

    body = _overview(client, headers)
    assert body["positions"] == []
    assert body["generated_at"]  # fresh timestamp present


def test_missing_market_data_handled_safely(client, auth_headers, monkeypatch):
    def _flaky(symbol):
        if symbol == "NODATA":
            raise HTTPException(status_code=404, detail="No market data found for symbol 'NODATA'")
        return _quote(symbol, 250)

    monkeypatch.setattr("services.market_data.get_quote", _flaky)
    headers = auth_headers()
    _create_position(client, headers, symbol="GOOD", entry_price=100)
    _create_position(client, headers, symbol="NODATA", entry_price=100)

    body = _overview(client, headers)  # must not 500
    rows = {r["symbol"]: r for r in body["positions"]}
    assert rows["GOOD"]["current_price"] == 250
    assert rows["GOOD"]["attention_tier"] in {"HIGH ATTENTION", "WATCH", "HEALTHY"}
    # The no-data position is listed transparently with no invented price
    assert rows["NODATA"]["current_price"] is None
    assert rows["NODATA"]["health_score"] is None
    assert rows["NODATA"]["attention_tier"] is None
    assert any("No live market data" in f for f in rows["NODATA"]["driving_factors"])
    # And it sorts to the bottom
    assert body["positions"][-1]["symbol"] == "NODATA"


def test_one_symbol_failure_uses_last_real_snapshot(client, db_session, auth_headers, monkeypatch):
    """Bad symbol's failure must not break the others, and it falls back to
    its last real stored snapshot instead of inventing a price."""
    failing = {"symbols": set()}

    def _flaky(symbol):
        if symbol in failing["symbols"]:
            raise HTTPException(status_code=502, detail="Could not reach Finnhub")
        return _quote(symbol, 250.0 if symbol == "GOOD" else 180.0)

    monkeypatch.setattr("services.market_data.get_quote", _flaky)
    headers = auth_headers()
    _create_position(client, headers, symbol="GOOD", entry_price=100)
    bad = _create_position(client, headers, symbol="BAD", entry_price=100)

    # Generate real snapshots/decisions for both while quotes are healthy
    r = client.post(f"/decisions/{bad['id']}/generate", headers=headers)
    assert r.status_code == 201, r.text

    # Now BAD's live quote fails -> navigator must fall back to the stored price
    failing["symbols"].add("BAD")
    body = _overview(client, headers)
    rows = {r["symbol"]: r for r in body["positions"]}
    assert rows["GOOD"]["current_price"] == 250.0
    assert rows["BAD"]["current_price"] == 180.0  # last real stored price, not invented
    assert rows["BAD"]["current_action"] is not None
    assert any("last known market data" in f for f in rows["BAD"]["driving_factors"])


def test_requires_authentication(client):
    assert client.get("/navigator/overview").status_code == 401


def test_ownership_isolation(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    alice = auth_headers("alice-nav@example.com")
    bob = auth_headers("bob-nav@example.com")

    _create_position(client, alice, symbol="AAPL")
    _create_position(client, alice, symbol="MSFT")

    assert len(_overview(client, alice)["positions"]) == 2
    assert _overview(client, bob)["positions"] == []  # never sees Alice's


def test_deterministic_repeatable_results(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),
        "MSFT": _quote("MSFT", 183),
        "NFLX": _quote("NFLX", 290),
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, stop_loss=175, target=200)
    _create_position(client, headers, symbol="NFLX", entry_price=300, stop_loss=295, target=350)

    first = _overview(client, headers)
    second = _overview(client, headers)

    def _signature(body):
        return [
            (r["symbol"], r["attention_score"], r["attention_tier"], r["current_action"])
            for r in body["positions"]
        ]

    assert _signature(first) == _signature(second)


def test_attention_component_math_is_explainable():
    """Pure-function sanity: the score decomposes into documented components,
    so a frontend can always reconstruct WHY a position ranked where it did."""
    # HEALTHY: strong score, HOLD, far from both stop and target
    assert navigator_service._attention_score(70.27, ActionType.HOLD, 11.6, 7.0) < 30
    # HIGH: low score + EXIT + breached stop
    assert navigator_service._attention_score(19.67, ActionType.EXIT, -1.7, 20.7) >= 60