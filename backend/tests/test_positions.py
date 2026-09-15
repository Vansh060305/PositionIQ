"""Position CRUD, ownership isolation, and the close-position lifecycle."""


def _create_position(client, headers, **overrides):
    payload = {
        "symbol": "AAPL",
        "exchange": "NASDAQ",
        "entry_price": 200,
        "quantity": 10,
        "stop_loss": 190,
        "target": 230,
        "position_type": "LONG",
    }
    payload.update(overrides)
    return client.post("/positions", json=payload, headers=headers)


def test_create_and_list_position(client, auth_headers):
    headers = auth_headers()
    r = _create_position(client, headers)
    assert r.status_code == 201

    r = client.get("/positions", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


def test_negative_price_rejected(client, auth_headers):
    headers = auth_headers()
    r = _create_position(client, headers, entry_price=-100)
    assert r.status_code == 422


def test_user_cannot_see_others_positions(client, auth_headers):
    alice = auth_headers("alice@example.com")
    bob = auth_headers("bob@example.com")

    _create_position(client, alice)

    r = client.get("/positions", headers=bob)
    assert r.status_code == 200
    assert len(r.json()) == 0


def test_user_cannot_modify_others_position(client, auth_headers):
    alice = auth_headers("alice@example.com")
    bob = auth_headers("bob@example.com")

    position_id = _create_position(client, alice).json()["id"]

    r = client.get(f"/positions/{position_id}", headers=bob)
    assert r.status_code == 403

    r = client.patch(f"/positions/{position_id}", json={"stop_loss": 1}, headers=bob)
    assert r.status_code == 403

    r = client.delete(f"/positions/{position_id}", headers=bob)
    assert r.status_code == 403


def test_update_rejects_status_field(client, auth_headers):
    """Closing must go through POST /close (which records exit price and
    realized P&L) - a PATCH that smuggles status is rejected outright."""
    headers = auth_headers()
    position_id = _create_position(client, headers).json()["id"]

    r = client.patch(f"/positions/{position_id}", json={"status": "CLOSED"}, headers=headers)
    assert r.status_code == 422


def test_partial_update_only_touches_sent_fields(client, auth_headers):
    headers = auth_headers()
    position_id = _create_position(client, headers).json()["id"]

    r = client.patch(f"/positions/{position_id}", json={"stop_loss": 195}, headers=headers)
    assert r.status_code == 200
    assert r.json()["stop_loss"] == 195
    assert r.json()["target"] == 230  # untouched


def test_close_long_position_computes_realized_pnl(client, auth_headers):
    headers = auth_headers()
    position_id = _create_position(client, headers, position_type="LONG").json()["id"]

    r = client.post(f"/positions/{position_id}/close", json={"exit_price": 220}, headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "CLOSED"
    assert body["realized_pnl"] == 200.0  # (220-200)*10


def test_close_short_position_profits_on_price_drop(client, auth_headers):
    headers = auth_headers()
    position_id = _create_position(
        client, headers, symbol="TSLA", entry_price=300, quantity=5, position_type="SHORT"
    ).json()["id"]

    r = client.post(f"/positions/{position_id}/close", json={"exit_price": 280}, headers=headers)
    assert r.status_code == 200
    assert r.json()["realized_pnl"] == 100.0  # (300-280)*5


def test_cannot_close_already_closed_position(client, auth_headers):
    headers = auth_headers()
    position_id = _create_position(client, headers).json()["id"]
    client.post(f"/positions/{position_id}/close", json={"exit_price": 220}, headers=headers)

    r = client.post(f"/positions/{position_id}/close", json={"exit_price": 225}, headers=headers)
    assert r.status_code == 400


def test_status_filter_separates_open_and_closed(client, auth_headers):
    headers = auth_headers()
    open_id = _create_position(client, headers, symbol="MSFT").json()["id"]
    closed_id = _create_position(client, headers, symbol="AAPL").json()["id"]
    client.post(f"/positions/{closed_id}/close", json={"exit_price": 210}, headers=headers)

    r = client.get("/positions?status=OPEN", headers=headers)
    open_ids = [p["id"] for p in r.json()]
    assert open_id in open_ids and closed_id not in open_ids

    r = client.get("/positions?status=CLOSED", headers=headers)
    closed_ids = [p["id"] for p in r.json()]
    assert closed_id in closed_ids and open_id not in closed_ids


def test_free_plan_position_limit(client, auth_headers):
    headers = auth_headers()
    for i in range(10):  # Free plan allows exactly 10 open positions
        r = _create_position(client, headers, symbol=f"SYM{i}")
        assert r.status_code == 201

    # The 11th open position must be rejected with the free-limit 403
    r = _create_position(client, headers, symbol="SYM10")
    assert r.status_code == 403
    assert "Upgrade" in r.json()["detail"]
