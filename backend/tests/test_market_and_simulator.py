"""Finnhub error handling (mocked) and the what-if simulator."""

from unittest.mock import patch, MagicMock


def _mock_quote(current=220, open_=215, high=222, low=214, prev_close=216):
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "c": current, "o": open_, "h": high, "l": low,
        "pc": prev_close, "d": current - prev_close, "dp": 1.5,
    }
    return resp


def test_finnhub_401_reports_bad_api_key(client, auth_headers):
    headers = auth_headers()
    resp = MagicMock()
    resp.status_code = 401
    with patch("services.market_data.requests.get", return_value=resp):
        r = client.get("/market/quote/AAPL", headers=headers)
    assert r.status_code == 503
    assert "API key" in r.json()["detail"]


def test_finnhub_invalid_symbol_returns_404(client, auth_headers):
    headers = auth_headers()
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {"c": 0, "o": 0, "h": 0, "l": 0, "pc": 0, "d": None, "dp": None}
    with patch("services.market_data.requests.get", return_value=resp):
        r = client.get("/market/quote/FAKESYM", headers=headers)
    assert r.status_code == 404


def test_finnhub_valid_quote_returns_parsed_data(client, auth_headers):
    headers = auth_headers()
    with patch("services.market_data.requests.get", return_value=_mock_quote()):
        r = client.get("/market/quote/aapl", headers=headers)
    assert r.status_code == 200
    assert r.json()["symbol"] == "AAPL"  # normalized to uppercase
    assert r.json()["current_price"] == 220


def test_simulator_predicts_book_profit_above_target(client, auth_headers):
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={
            "symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 200,
            "quantity": 10, "stop_loss": 190, "target": 230,
        },
        headers=headers,
    ).json()["id"]

    r = client.post(f"/simulator/{position_id}", json={"simulated_price": 235}, headers=headers)
    assert r.status_code == 200
    assert r.json()["predicted_action"] == "BOOK_PROFIT"


def test_simulator_predicts_exit_below_stop(client, auth_headers):
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={
            "symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 200,
            "quantity": 10, "stop_loss": 190, "target": 230,
        },
        headers=headers,
    ).json()["id"]

    r = client.post(f"/simulator/{position_id}", json={"simulated_price": 180}, headers=headers)
    assert r.status_code == 200
    assert r.json()["predicted_action"] == "EXIT"


def test_simulator_does_not_create_real_snapshot_or_decision(client, auth_headers, db_session):
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={"symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 200, "quantity": 10},
        headers=headers,
    ).json()["id"]

    client.post(f"/simulator/{position_id}", json={"simulated_price": 210}, headers=headers)

    r = client.get(f"/health/{position_id}/history", headers=headers)
    assert r.json() == []  # a simulation is hypothetical, not a real analysis


def test_alerts_are_not_duplicated_across_ticks(client, auth_headers, db_session):
    """The same condition (score < 40, stop near) must not spawn a new alert on
    every 60s broadcast tick - only one alert per position+type within the
    dedupe window."""
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={
            "symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 100,
            "quantity": 10, "stop_loss": 99,
        },
        headers=headers,
    ).json()["id"]

    def count_alerts():
        return len(client.get("/alerts", headers=headers).json())

    # Volatile quote (high-low = 20%) while the price hugs the stop -> the
    # health score lands below 40 and the stop is within 5% => both alert types
    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "c": 100, "o": 100, "h": 110, "l": 90,
        "pc": 100, "d": 0, "dp": 0,
    }
    with patch("services.market_data.requests.get", return_value=resp):
        client.post(f"/decisions/{position_id}/generate", headers=headers)
        first_count = count_alerts()
        assert first_count > 0  # at least one alert fired

        # Second tick a moment later must NOT add duplicates
        client.post(f"/decisions/{position_id}/generate", headers=headers)
        assert count_alerts() == first_count


def test_delete_position_with_analysis_alerts_and_whatif(client, auth_headers):
    """Deleting a position that has health snapshots, decisions, alerts AND
    what-if runs must succeed - no dangling foreign keys, no 500."""
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={
            "symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 100,
            "quantity": 10, "stop_loss": 99,
        },
        headers=headers,
    ).json()["id"]

    resp = MagicMock()
    resp.status_code = 200
    resp.json.return_value = {
        "c": 100, "o": 100, "h": 105, "l": 95, "pc": 100, "d": 0, "dp": 0,
    }
    with patch("services.market_data.requests.get", return_value=resp):
        client.post(f"/decisions/{position_id}/generate", headers=headers)
    client.post(f"/simulator/{position_id}", json={"simulated_price": 120}, headers=headers)
    assert len(client.get("/alerts", headers=headers).json()) > 0

    r = client.delete(f"/positions/{position_id}", headers=headers)
    assert r.status_code == 204
    assert client.get(f"/positions/{position_id}", headers=headers).status_code == 404


def test_generate_decision_full_flow(client, auth_headers):
    headers = auth_headers()
    position_id = client.post(
        "/positions",
        json={
            "symbol": "TSLA", "exchange": "NASDAQ", "entry_price": 200,
            "quantity": 5, "stop_loss": 190, "target": 250,
        },
        headers=headers,
    ).json()["id"]

    with patch("services.market_data.requests.get", return_value=_mock_quote(current=210)):
        r = client.post(f"/decisions/{position_id}/generate", headers=headers)
    assert r.status_code == 201
    assert r.json()["action"] in [
        "HOLD", "BOOK_PROFIT", "TIGHTEN_STOP", "REDUCE", "HEDGE", "EXIT"
    ]

    r = client.get(f"/decisions/{position_id}/latest", headers=headers)
    assert r.status_code == 200
