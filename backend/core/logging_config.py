"""
Basic logging setup.

WHY THIS FILE EXISTS:
Gives structured, consistent logs from day one instead of scattered
print() statements. In Phase 16 (monitoring) we plug Sentry in here
without touching any other file - that's the point of isolating it.
"""

import logging

from core.config import settings


def configure_logging() -> None:
    level = logging.DEBUG if settings.debug else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    )
