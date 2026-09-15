"""Portfolio analytics: sector exposure, diversification score, isolation."""


def test_empty_portfolio(client, auth_headers):
    headers = auth_headers()
    r = client.get("/portfolio/summary", headers=headers)
    assert r.status_code == 200
    assert r.json()["position_count"] == 0
    assert r.json()["diversification_score"] == 0.0


def test_concentrated_portfolio_scores_zero_diversification(client, auth_headers):
    headers = auth_headers()
    client.post(
        "/positions",
        json={"symbol": "AAPL", "exchange": "NASDAQ", "sector": "Tech", "entry_price": 100, "quantity": 10},
        headers=headers,
    )
    client.post(
        "/positions",
        json={"symbol": "MSFT", "exchange": "NASDAQ", "sector": "Tech", "entry_price": 200, "quantity": 5},
        headers=headers,
    )

    r = client.get("/portfolio/summary", headers=headers)
    assert r.json()["diversification_score"] == 0.0
    assert len(r.json()["sector_breakdown"]) == 1


def test_two_equal_sectors_score_fifty(client, auth_headers):
    headers = auth_headers()
    client.post(
        "/positions",
        json={"symbol": "AAPL", "exchange": "NASDAQ", "sector": "Tech", "entry_price": 100, "quantity": 10},
        headers=headers,
    )
    client.post(
        "/positions",
        json={"symbol": "XOM", "exchange": "NYSE", "sector": "Energy", "entry_price": 100, "quantity": 10},
        headers=headers,
    )

    r = client.get("/portfolio/summary", headers=headers)
    assert r.json()["diversification_score"] == 50.0


def test_portfolios_are_isolated_between_users(client, auth_headers):
    alice = auth_headers("alice@example.com")
    bob = auth_headers("bob@example.com")

    client.post(
        "/positions",
        json={"symbol": "AAPL", "exchange": "NASDAQ", "entry_price": 100, "quantity": 10},
        headers=alice,
    )

    r = client.get("/portfolio/summary", headers=bob)
    assert r.json()["position_count"] == 0
