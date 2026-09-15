"""
Run once after DATABASE_URL is set in .env:

    python init_db.py

Creates every table defined in models/. Alembic migrations can replace
this later (Phase 16) if versioned schema changes are needed - kept
simple here on purpose.
"""

from core.database import Base, engine
import models  # noqa: F401  (import registers all models with Base)

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    print("All tables created successfully.")
