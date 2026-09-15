# Shared fixtures for every test file. Each test gets a FRESH in-memory
# SQLite database - tests never touch the real Neon Postgres DB, and
# never leak state between each other.

import os
import sys

# Env vars must be set before core.config.Settings() is instantiated at
# import time - so this has to happen before importing anything from `main`.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("FINNHUB_API_KEY", "test-finnhub-key")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from core.database import Base, get_db
import models  # noqa: F401 - registers every model with Base
from main import app


@pytest.fixture()
def db_session():
    # A brand new in-memory DB engine per test function = full isolation.
    # StaticPool is required here: without it, SQLAlchemy opens a NEW
    # connection per session, and each connection to ":memory:" is its
    # own separate (empty) database - StaticPool forces every session
    # from this engine to reuse the one connection that actually has
    # the tables created below.
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield TestingSessionLocal
    app.dependency_overrides.clear()


@pytest.fixture()
def client(db_session):
    return TestClient(app)


@pytest.fixture()
def auth_headers(client):
    """Registers a fresh user, logs in immediately (accounts are usable right
    away - no email verification step), and returns ready-to-use headers.
    """

    def _make(email="user@example.com", password="pass1234"):
        client.post("/auth/register", json={"email": email, "password": password})
        r = client.post("/auth/login", data={"username": email, "password": password})
        token = r.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _make
