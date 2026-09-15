"""
Live market update flow: the ~60s broadcast tick must push a payload that
carries the fresh market data + score + an ISO timestamp (so the frontend can
update prices/P&L without a REST round trip), keep ticking when one symbol's
quote fails, and never broadcast forever to a dead WebSocket.

These tests run the tick/manager logic directly (no real timer, no network,
no Finnhub - quotes are deterministic doubles) and one real WebSocket
handshake through the TestClient for the initial-sync payload shape.
"""

import asyncio
import time
import uuid

import pytest
from fastapi import HTTPException

from core.security import decode_access_token
from services.connection_manager import manager
from services.background_tasks import run_broadcast_tick


@pytest.fixture(autouse=True)
def _clean_manager():
    """The connection manager is a module-level singleton shared across
    tests - never let one test's connections leak into the next."""
    manager.active_connections.clear()
    yield
    manager.active_connections.clear()


class FakeWebSocket:
    """Records everything the broadcaster sends - stands in for a real
    browser WebSocket in the connection registry."""

    def __init__(self, fail=False):
        self.sent = []
        self.fail = fail

    async def send_json(self, message):
        if self.fail:
            raise RuntimeError("connection lost")
        self.sent.append(message)


def _register_and_login(client, email=None):
    email = email or f"live-{uuid.uuid4().hex[:10]}@example.com"
    password = "pass1234"
    r = client.post("/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": password})
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return email, token, {"Authorization": f"Bearer {token}"}


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


def _fake_quote(price=250.0):
    def _get(symbol):
        return {
            "symbol": symbol.upper(),
            "current_price": price,
            "open": price - 1,
            "high": price + 1.5,
            "low": price - 2,
            "previous_close": price - 0.5,
            "change": 0.5,
            "percent_change": 0.2,
        }

    return _get


def test_tick_pushes_enriched_payload_and_fresh_timestamp(
    client, db_session, monkeypatch
):
    monkeypatch.setattr("services.market_data.get_quote", _fake_quote(price=250.0))
    # The tick opens its own DB sessions via background_tasks.SessionLocal -
    # point it at the same in-memory test DB the API is using.
    monkeypatch.setattr("services.background_tasks.SessionLocal", db_session)

    _email, token, headers = _register_and_login(client)
    user_id = decode_access_token(token)["sub"]
    position = _create_position(client, headers)

    ws = FakeWebSocket()
    manager.active_connections[user_id] = [ws]

    asyncio.run(run_broadcast_tick())

    assert len(ws.sent) == 1
    msg = ws.sent[0]
    assert msg["type"] == "decision_update"
    assert msg["position_id"] == position["id"]
    assert msg["action"] in {"HOLD", "BOOK_PROFIT", "TIGHTEN_STOP", "REDUCE", "HEDGE", "EXIT"}
    assert isinstance(msg["confidence"], float) and 0 <= msg["confidence"] <= 1
    # Market data straight from the freshly-fetched quote (200 -> 250 = +25%)
    assert msg["current_price"] == 250.0
    assert isinstance(msg["health_score"], float) and 0 <= msg["health_score"] <= 100
    assert msg["pnl_percent"] == pytest.approx(25.0)
    # The timestamp is a real ISO marker, distinct per cycle
    from datetime import datetime

    first_ts = datetime.fromisoformat(msg["timestamp"])
    assert first_ts.tzinfo is not None

    # Second cycle: new timestamp, exactly one new snapshot + decision each -
    # score history comes from real results, no duplicates per tick.
    # Windows (Python <= 3.12) clock granularity is ~15ms: two back-to-back
    # ticks can otherwise land on the SAME datetime.now() value and break the
    # strictly-increasing timestamp assertion below.
    time.sleep(0.05)
    asyncio.run(run_broadcast_tick())

    assert len(ws.sent) == 2
    second_ts = datetime.fromisoformat(ws.sent[1]["timestamp"])
    assert second_ts > first_ts

    db = db_session()
    try:
        from models.health_snapshot import HealthSnapshot
        from models.decision import Decision

        assert db.query(HealthSnapshot).count() == 2
        assert db.query(Decision).count() == 2
    finally:
        db.close()


def test_failed_quote_does_not_stop_other_positions(client, db_session, monkeypatch):
    def _flaky_quote(symbol):
        if symbol == "BAD":
            raise HTTPException(status_code=429, detail="Finnhub rate limit hit")
        return _fake_quote(price=250.0)(symbol)

    monkeypatch.setattr("services.market_data.get_quote", _flaky_quote)
    monkeypatch.setattr("services.background_tasks.SessionLocal", db_session)

    _email, token, headers = _register_and_login(client)
    user_id = decode_access_token(token)["sub"]
    good = _create_position(client, headers, symbol="GOOD", entry_price=100, target=150, stop_loss=80)
    _create_position(client, headers, symbol="BAD", entry_price=100, target=150, stop_loss=80)

    ws = FakeWebSocket()
    manager.active_connections[user_id] = [ws]

    # Must not raise even though one symbol's quote failed
    asyncio.run(run_broadcast_tick())

    good_msgs = [m for m in ws.sent if m["position_id"] == good["id"]]
    assert len(good_msgs) == 1
    assert good_msgs[0]["current_price"] == 250.0


def test_manager_drops_dead_sockets_on_send():
    dead = FakeWebSocket(fail=True)
    alive = FakeWebSocket()
    manager.active_connections["user-1"] = [dead, alive]

    asyncio.run(manager.send_to_user("user-1", {"type": "decision_update", "ok": True}))

    assert alive.sent == [{"type": "decision_update", "ok": True}]
    assert dead.sent == []
    # The dead socket is no longer registered for future broadcasts
    assert manager.active_connections["user-1"] == [alive]


def test_manager_removes_user_when_all_sockets_dead():
    manager.active_connections["user-1"] = [FakeWebSocket(fail=True)]

    asyncio.run(manager.send_to_user("user-1", {"type": "decision_update"}))

    assert "user-1" not in manager.active_connections


def test_ws_initial_sync_uses_enriched_payload(client, db_session, monkeypatch):
    monkeypatch.setattr("services.market_data.get_quote", _fake_quote(price=250.0))
    # ws.py opens its own session directly (not via get_db) - redirect it to
    # the in-memory test DB for the handshake.
    monkeypatch.setattr("routes.ws.SessionLocal", db_session)

    _email, token, headers = _register_and_login(client)
    user_id = decode_access_token(token)["sub"]
    position = _create_position(client, headers)

    # Give the position a decision first so the initial sync has something to send
    r = client.post(f"/decisions/{position['id']}/generate", headers=headers)
    assert r.status_code == 201, r.text

    with client.websocket_connect(f"/ws/positions?token={token}") as ws:
        msg = ws.receive_json()

    assert msg["type"] == "decision_update"
    assert msg["position_id"] == position["id"]
    assert msg["current_price"] == 250.0
    assert msg["pnl_percent"] == pytest.approx(25.0)
    assert isinstance(msg["health_score"], float)
    from datetime import datetime

    datetime.fromisoformat(msg["timestamp"])  # must parse

    # The handshake finished, so the connection must have been cleaned up
    assert user_id not in manager.active_connections
