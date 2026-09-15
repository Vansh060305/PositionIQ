"""
Market Pulse backend tests.

The pulse is a read-only, deterministic summary of a user's open holdings
built from real (or last-stored) market data and the existing health engine.
Quotes here are deterministic doubles - no network, no Finnhub - so statuses,
counts, and reasons are fully predictable.
"""

import uuid

import pytest

from models.decision import Decision
from models.health_snapshot import HealthSnapshot


def _register_and_login(client, email=None):
    email = email or f"pulse-{uuid.uuid4().hex[:10]}@example.com"
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
    """Deterministic Finnhub-style quote. High/low = +-2% (4% volatility).
    prev_close defaults to price*0.99 -> day trend UP (~+1%)."""
    pc = price * 0.99 if prev_close is None else prev_close
    return {
        "symbol": symbol.upper(),
        "current_price": price,
        "open": price - 1,
        "high": round(price * 1.02, 4),
        "low": round(price * 0.98, 4),
        "previous_close": pc,
        "change": round(price - pc, 4),
        "percent_change": round((price - pc) / pc * 100, 4) if pc else 0,
    }


def _overview(client, headers):
    r = client.get("/pulse/overview", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------------------
# 1 + 2. Authentication
# ---------------------------------------------------------------------------


def test_requires_authentication(client):
    assert client.get("/pulse/overview").status_code == 401


def test_authenticated_request_succeeds(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL")
    body = _overview(client, headers)
    assert body["market_scope"] == "Your Holdings Market Pulse"
    assert body["total_open_positions"] == 1
    assert body["generated_at"]


# ---------------------------------------------------------------------------
# 3. User ownership / isolation
# ---------------------------------------------------------------------------


def test_ownership_isolation(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    alice = auth_headers("alice-pulse@example.com")
    bob = auth_headers("bob-pulse@example.com")

    _create_position(client, alice, symbol="AAPL")
    _create_position(client, alice, symbol="MSFT")

    assert _overview(client, alice)["total_open_positions"] == 2
    bob_body = _overview(client, bob)  # Bob never sees Alice's holdings
    assert bob_body["total_open_positions"] == 0
    assert bob_body["pulse_status"] is None
    assert bob_body["headline"] == "No open positions to analyze"


# ---------------------------------------------------------------------------
# 4. Empty portfolio
# ---------------------------------------------------------------------------


def test_empty_portfolio(client, auth_headers, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", lambda s: _quote(s, 215))
    headers = auth_headers()
    body = _overview(client, headers)
    assert body["pulse_status"] is None
    assert body["headline"] == "No open positions to analyze"
    assert body["total_open_positions"] == 0
    assert body["positions"] == []
    assert body["total_exposure"] == 0.0
    assert body["positions_up"] == body["positions_down"] == 0


# ---------------------------------------------------------------------------
# 5. All positive -> POSITIVE
# ---------------------------------------------------------------------------


def test_all_positive_positions_pulse_positive(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),   # +7.5% P&L, day UP
        "MSFT": _quote("MSFT", 195),   # +8.3% P&L, day UP
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, quantity=10,
                     stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, quantity=20,
                     stop_loss=175, target=220)

    body = _overview(client, headers)
    assert body["pulse_status"] == "POSITIVE"
    assert body["positions_up"] == 2
    assert body["positions_down"] == 0
    assert body["symbols_up_today"] == 2
    assert body["exposure_weighted_health"] == pytest.approx(67.97, abs=0.3)
    assert any("2 of 2 open positions are in profit" in r for r in body["reasons"])


# ---------------------------------------------------------------------------
# 6. Mixed positive/negative -> NEUTRAL
# ---------------------------------------------------------------------------


def test_mixed_positions_pulse_neutral(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),  # +7.5%, day UP
        "MSFT": _quote("MSFT", 195),  # +8.3%, day UP
        "GOOG": _quote("GOOG", 185, prev_close=186.9),  # -7.5%, day DOWN
        "NFLX": _quote("NFLX", 285, prev_close=287.9),  # -5.0%, day DOWN
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, quantity=10,
                     stop_loss=190, target=230)
    _create_position(client, headers, symbol="MSFT", entry_price=180, quantity=20,
                     stop_loss=175, target=220)
    _create_position(client, headers, symbol="GOOG", entry_price=200, quantity=10,
                     stop_loss=175, target=160)
    _create_position(client, headers, symbol="NFLX", entry_price=300, quantity=10,
                     stop_loss=295, target=260)

    body = _overview(client, headers)
    assert body["pulse_status"] == "NEUTRAL"
    assert body["positions_up"] == 2
    assert body["positions_down"] == 2
    assert body["symbols_up_today"] == 2
    assert body["symbols_down_today"] == 2
    assert any("2 of 4 open positions are in profit" in r for r in body["reasons"])
    assert any("2 of 4 open positions are showing a loss" in r for r in body["reasons"])


def test_all_losing_pulse_negative(client, auth_headers, monkeypatch):
    # Deep loss with a breached stop -> NEGATIVE (also exercises the 4th status).
    monkeypatch.setattr(
        "services.market_data.get_quote",
        lambda s: _quote("NFLX", 250, prev_close=252.5),  # day DOWN
    )
    headers = auth_headers()
    _create_position(client, headers, symbol="NFLX", entry_price=300, quantity=10,
                     stop_loss=295, target=230)

    body = _overview(client, headers)
    assert body["pulse_status"] == "NEGATIVE"
    assert body["positions_down"] == 1
    assert body["symbols_down_today"] == 1


# ---------------------------------------------------------------------------
# 7. Unchanged / unknown data
# ---------------------------------------------------------------------------


def test_flat_and_unknown_handling(client, auth_headers, monkeypatch):
    def _mixed(symbol):
        if symbol == "NODATA":
            raise Exception("simulated total failure")
        return _quote(symbol, 200, prev_close=200)  # exact flat day, flat P&L

    monkeypatch.setattr("services.market_data.get_quote", _mixed)
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200)
    _create_position(client, headers, symbol="NODATA", entry_price=100)

    body = _overview(client, headers)  # must not 500
    assert body["positions_flat"] == 1
    assert body["positions_unknown"] == 1
    assert body["symbols_flat_today"] == 1
    # The no-data position is listed transparently with no invented values
    nodata = next(p for p in body["positions"] if p["symbol"] == "NODATA")
    assert nodata["data_source"] == "NONE"
    assert nodata["current_price"] is None
    assert nodata["health_score"] is None
    assert any("No market data available for 1 position(s)" in r for r in body["reasons"])
    # With data present the pulse still resolves to a real status
    assert body["pulse_status"] in {"POSITIVE", "NEUTRAL", "CAUTION", "NEGATIVE"}


# ---------------------------------------------------------------------------
# 8. One symbol failure while others succeed (falls back to last real snapshot)
# ---------------------------------------------------------------------------


def test_one_symbol_failure_uses_last_real_snapshot(client, db_session, auth_headers, monkeypatch):
    failing = {"symbols": set()}

    def _flaky(symbol):
        if symbol in failing["symbols"]:
            raise Exception("simulated Finnhub failure")
        return _quote(symbol, 250.0 if symbol == "GOOD" else 180.0)

    monkeypatch.setattr("services.market_data.get_quote", _flaky)
    headers = auth_headers()
    _create_position(client, headers, symbol="GOOD", entry_price=100)
    bad = _create_position(client, headers, symbol="BAD", entry_price=100)

    # Generate real snapshots/decisions while quotes are healthy
    r = client.post(f"/decisions/{bad['id']}/generate", headers=headers)
    assert r.status_code == 201, r.text

    # Now BAD's live quote fails -> pulse must fall back to the stored price
    failing["symbols"].add("BAD")
    body = _overview(client, headers)
    rows = {p["symbol"]: p for p in body["positions"]}
    assert rows["GOOD"]["data_source"] == "LIVE"
    assert rows["GOOD"]["current_price"] == 250.0
    assert rows["BAD"]["data_source"] == "STALE"
    assert rows["BAD"]["current_price"] == 180.0  # last real stored price, not invented
    assert rows["BAD"]["health_score"] is not None
    assert any("using last known market data" in r for r in body["reasons"])


# ---------------------------------------------------------------------------
# 9. All market data unavailable
# ---------------------------------------------------------------------------


def test_all_market_data_unavailable(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "services.market_data.get_quote",
        lambda s: (_ for _ in ()).throw(Exception("simulated Finnhub down")),
    )
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL")
    _create_position(client, headers, symbol="MSFT")

    body = _overview(client, headers)
    assert body["pulse_status"] is None  # never fake a pulse from nothing
    assert body["headline"] == "Live market data is currently unavailable"
    assert body["positions_unknown"] == 2
    assert all(p["data_source"] == "NONE" for p in body["positions"])
    assert body["positions_up"] == body["positions_down"] == 0


# ---------------------------------------------------------------------------
# 10. Deterministic pulse status / reasons
# ---------------------------------------------------------------------------


def test_deterministic_repeatable_results(client, auth_headers, monkeypatch):
    quotes = {
        "AAPL": _quote("AAPL", 215),
        "MSFT": _quote("MSFT", 195),
        "GOOG": _quote("GOOG", 185),
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200)
    _create_position(client, headers, symbol="MSFT", entry_price=180)
    _create_position(client, headers, symbol="GOOG", entry_price=200, stop_loss=175, target=160)

    first = _overview(client, headers)
    second = _overview(client, headers)

    def _signature(body):
        return (
            body["pulse_status"],
            body["headline"],
            tuple(body["reasons"]),
            tuple(
                (p["symbol"], p["current_price"], p["pnl_percent"], p["data_source"])
                for p in body["positions"]
            ),
        )

    assert _signature(first) == _signature(second)


# ---------------------------------------------------------------------------
# 11. Exposure / holdings calculations
# ---------------------------------------------------------------------------


def test_exposure_and_holdings_metrics(client, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "services.market_data.get_quote", lambda s: _quote(s, 215 if s == "AAPL" else 195)
    )
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200, quantity=10, sector="Technology")
    _create_position(client, headers, symbol="MSFT", entry_price=180, quantity=20,
                     stop_loss=175, target=220, sector="Software")

    body = _overview(client, headers)
    assert body["total_exposure"] == pytest.approx(200 * 10 + 180 * 20)  # cost basis
    # Shares 2000/5600 + 3600/5600 -> HHI 0.5408 -> diversification 45.92
    assert body["diversification_score"] == pytest.approx(45.92, abs=0.1)
    # Exposure-weighted health: (70.27*2000 + 66.7*3600) / 5600
    assert body["exposure_weighted_health"] == pytest.approx(67.97, abs=0.3)
    assert body["avg_health_score"] is not None
    assert body["avg_volatility"] == pytest.approx(4.0, abs=0.1)
    assert any("diversified across 2 sectors" in r for r in body["reasons"])


# ---------------------------------------------------------------------------
# 12. LONG / SHORT correctness
# ---------------------------------------------------------------------------


def test_long_short_direction_awareness(client, auth_headers, monkeypatch):
    # SHORT: entry 300, price 280 -> PROFIT (price fell since entry), yet the
    # stock itself is UP today vs yesterday's close - two distinct signals.
    quotes = {
        "SHORTX": _quote("SHORTX", 280, prev_close=277.2),  # day UP (+1%)
        "LONGX": _quote("LONGX", 185, prev_close=186.9),    # day DOWN (-1%)
    }
    monkeypatch.setattr("services.market_data.get_quote", lambda s: quotes[s])
    headers = auth_headers()
    _create_position(client, headers, symbol="SHORTX", entry_price=300, quantity=5,
                     stop_loss=330, target=250, position_type="SHORT")
    _create_position(client, headers, symbol="LONGX", entry_price=200, quantity=10,
                     stop_loss=175, target=160, position_type="LONG")

    body = _overview(client, headers)
    rows = {p["symbol"]: p for p in body["positions"]}
    # P&L is direction-aware: the SHORT is in profit, the LONG is in a loss
    assert rows["SHORTX"]["pnl_percent"] == pytest.approx(6.67, abs=0.1)
    assert rows["LONGX"]["pnl_percent"] == pytest.approx(-7.5, abs=0.1)
    assert body["positions_up"] == 1
    assert body["positions_down"] == 1
    # Day change is symbol-level and direction-independent
    assert rows["SHORTX"]["day_trend"] == "UP"
    assert rows["LONGX"]["day_trend"] == "DOWN"
    assert body["symbols_up_today"] == 1
    assert body["symbols_down_today"] == 1


# ---------------------------------------------------------------------------
# 13. No database writes
# ---------------------------------------------------------------------------


def test_pulse_never_writes_to_database(client, db_session, auth_headers, monkeypatch):
    monkeypatch.setattr(
        "services.market_data.get_quote", lambda s: _quote(s, 215 if s == "AAPL" else 195)
    )
    headers = auth_headers()
    _create_position(client, headers, symbol="AAPL", entry_price=200)
    _create_position(client, headers, symbol="MSFT", entry_price=180)

    db = db_session()
    snapshots_before = db.query(HealthSnapshot).count()
    decisions_before = db.query(Decision).count()

    _overview(client, headers)
    _overview(client, headers)  # twice, to be sure

    assert db.query(HealthSnapshot).count() == snapshots_before
    assert db.query(Decision).count() == decisions_before
    db.close()


# ---------------------------------------------------------------------------
# Pure-function sanity for the deterministic status mapping
# ---------------------------------------------------------------------------


def test_status_mapping_thresholds():
    from services.pulse_service import _status_for

    assert _status_for(80) == "POSITIVE"
    assert _status_for(65) == "POSITIVE"
    assert _status_for(64.9) == "NEUTRAL"
    assert _status_for(45) == "NEUTRAL"
    assert _status_for(44.9) == "CAUTION"
    assert _status_for(25) == "CAUTION"
    assert _status_for(24.9) == "NEGATIVE"