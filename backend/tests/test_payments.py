"""PRO Demo activation and subscription status - no payment involved."""


def test_subscription_defaults_to_free(client, auth_headers):
    headers = auth_headers()
    r = client.get("/payments/subscription", headers=headers)
    assert r.status_code == 200
    assert r.json()["plan"] == "FREE"


def test_activate_pro_demo_activates_pro(client, auth_headers):
    headers = auth_headers()
    r = client.post("/payments/activate-pro-demo", headers=headers)
    assert r.status_code == 200
    assert r.json()["plan"] == "PRO"
    assert r.json()["status"] == "ACTIVE"
    assert r.json()["expires_at"] is None  # permanent - demo never expires

    r = client.get("/payments/subscription", headers=headers)
    assert r.json()["plan"] == "PRO"


def test_activate_pro_demo_is_idempotent(client, auth_headers):
    headers = auth_headers()
    r1 = client.post("/payments/activate-pro-demo", headers=headers)
    r2 = client.post("/payments/activate-pro-demo", headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    # Same subscription returned - no duplicate rows
    assert r1.json()["id"] == r2.json()["id"]


def test_activate_pro_demo_requires_auth(client):
    r = client.post("/payments/activate-pro-demo")
    assert r.status_code == 401


def test_pro_demo_bypasses_free_tier_position_limit(client, auth_headers):
    headers = auth_headers()
    client.post("/payments/activate-pro-demo", headers=headers)

    for i in range(11):  # more than the Free-plan limit of 10 - PRO stays unlimited
        r = client.post(
            "/positions",
            json={"symbol": f"SYM{i}", "exchange": "NASDAQ", "entry_price": 100, "quantity": 1},
            headers=headers,
        )
        assert r.status_code == 201