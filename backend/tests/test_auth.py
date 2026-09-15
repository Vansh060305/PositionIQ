"""Auth: register, login, /me, and token validation."""


def test_register_creates_user_ready_to_login(client):
    # Accounts are created active immediately - no email verification step.
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "pass1234"})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "a@example.com"
    assert body["role"] == "USER"
    assert body["is_active"] is True
    r = client.post("/auth/login", data={"username": "a@example.com", "password": "pass1234"})
    assert r.status_code == 200


def test_register_duplicate_email_rejected(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "pass1234"})
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "pass1234"})
    assert r.status_code == 400


def test_register_empty_password_rejected(client):
    r = client.post("/auth/register", json={"email": "a@example.com", "password": ""})
    assert r.status_code == 422


def test_register_short_password_rejected(client):
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "a"})
    assert r.status_code == 422
    # 7 chars is still below the 8-char minimum
    r = client.post("/auth/register", json={"email": "b@example.com", "password": "1234567"})
    assert r.status_code == 422


def test_register_minimum_length_password_accepted(client):
    r = client.post("/auth/register", json={"email": "a@example.com", "password": "12345678"})
    assert r.status_code == 201
    assert r.json()["email"] == "a@example.com"


def test_register_invalid_email_rejected(client):
    r = client.post("/auth/register", json={"email": "not-an-email", "password": "pass1234"})
    assert r.status_code == 422


def test_login_success_returns_token(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "pass1234"})
    r = client.post("/auth/login", data={"username": "a@example.com", "password": "pass1234"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "pass1234"})
    r = client.post("/auth/login", data={"username": "a@example.com", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_valid_token(client, auth_headers):
    headers = auth_headers()
    r = client.get("/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["email"] == "user@example.com"


def test_protected_route_without_token_is_401(client):
    r = client.get("/positions")
    assert r.status_code == 401
