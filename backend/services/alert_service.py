# Called right after a decision is generated, using the same snapshot -
# keeps alerts and decisions always based on identical data, never a
# slightly-stale price.

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models.alert import Alert, AlertType
from models.health_snapshot import HealthSnapshot
from models.position import Position
from models.user import User

# The background broadcaster re-analyzes open positions every 60 seconds,
# so a position sitting below a threshold would otherwise spawn a new
# alert every single tick. No alert is repeated for the same position and
# type within this window, regardless of read state - the user gets one
# clear notification, then silence until the condition changes/returns.
ALERT_DEDUPE_WINDOW_MINUTES = 30


def _recent_alert_exists(db: Session, position: Position, alert_type: AlertType) -> bool:
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=ALERT_DEDUPE_WINDOW_MINUTES)
    return (
        db.query(Alert.id)
        .filter(
            Alert.position_id == position.id,
            Alert.type == alert_type,
            Alert.created_at >= cutoff,
        )
        .first()
        is not None
    )


def check_and_create_alerts(db: Session, position: Position, snapshot: HealthSnapshot) -> list[Alert]:
    alerts = []

    if snapshot.health_score < 40 and not _recent_alert_exists(db, position, AlertType.HEALTH_DROP):
        alerts.append(
            Alert(
                user_id=position.user_id,
                position_id=position.id,
                type=AlertType.HEALTH_DROP,
                message=f"{position.symbol}'s health score dropped to {snapshot.health_score:.0f}. Worth a look.",
            )
        )

    if (
        snapshot.distance_to_stop is not None
        and 0 < snapshot.distance_to_stop <= 5
        and not _recent_alert_exists(db, position, AlertType.STOP_NEAR)
    ):
        alerts.append(
            Alert(
                user_id=position.user_id,
                position_id=position.id,
                type=AlertType.STOP_NEAR,
                message=f"{position.symbol} is within {snapshot.distance_to_stop:.1f}% of its stop-loss.",
            )
        )

    if (
        snapshot.distance_to_target is not None
        and 0 < snapshot.distance_to_target <= 5
        and not _recent_alert_exists(db, position, AlertType.TARGET_NEAR)
    ):
        alerts.append(
            Alert(
                user_id=position.user_id,
                position_id=position.id,
                type=AlertType.TARGET_NEAR,
                message=f"{position.symbol} is within {snapshot.distance_to_target:.1f}% of its target.",
            )
        )

    for alert in alerts:
        db.add(alert)
    if alerts:
        db.commit()
        for alert in alerts:
            db.refresh(alert)

    return alerts


def list_alerts(db: Session, user: User, unread_only: bool = False) -> list[Alert]:
    query = db.query(Alert).filter(Alert.user_id == user.id)
    if unread_only:
        query = query.filter(Alert.is_read.is_(False))
    return query.order_by(Alert.created_at.desc()).all()


def mark_alert_read(db: Session, user: User, alert_id) -> Alert:
    from fastapi import HTTPException, status

    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == user.id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert
