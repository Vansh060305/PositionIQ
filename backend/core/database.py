"""
Database connection setup.

WHY THIS FILE EXISTS:
- `engine`      -> the actual connection to PostgreSQL.
- `SessionLocal`-> a factory that creates a new DB session per request.
- `Base`        -> the parent class every SQLAlchemy model (Phase 2) inherits from.
- `get_db()`    -> a FastAPI dependency that opens a session, hands it to the
                   route/service, and closes it afterward - even on error.

This file is written once and does not change across phases.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from core.config import settings

# pool_pre_ping: serverless hosts like Neon close idle connections ("SSL
# connection has been closed unexpectedly"). Each checkout runs a cheap
# SELECT 1 first, so a stale pooled connection is discarded instead of
# surfacing as a transient 500 mid-request.
engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
