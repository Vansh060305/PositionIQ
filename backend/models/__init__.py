"""
Import every model here so Base.metadata is aware of all tables
when init_db.py creates them.
"""

from models.user import User
from models.position import Position
from models.health_snapshot import HealthSnapshot
from models.decision import Decision
from models.alert import Alert
from models.subscription import Subscription
from models.audit_log import AuditLog
from models.what_if_run import WhatIfRun

__all__ = [
    "User",
    "Position",
    "HealthSnapshot",
    "Decision",
    "Alert",
    "Subscription",
    "AuditLog",
    "WhatIfRun",
]
