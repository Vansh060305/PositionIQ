# Summarizes every open position's most recent health score and action
# into one email. Uses whatever the LATEST already-saved decision is for
# each position - does not trigger new Finnhub calls, so sending a digest
# never costs API quota.

from sqlalchemy.orm import Session

from models.user import User
from models.position import Position, PositionStatus
from models.decision import Decision
from services.email_service import send_email


def build_digest_html(user: User, rows: list[dict]) -> str:
    if not rows:
        return f"<p>Hi {user.email},</p><p>No open positions with an analysis yet today.</p>"

    rows_html = "".join(
        f"<tr><td>{r['symbol']}</td><td>{r['health_score']}</td><td>{r['action']}</td></tr>"
        for r in rows
    )
    return f"""
    <div style="font-family: sans-serif; color: #0A0F1C;">
      <h2>Your daily PositionIQ digest</h2>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
        <tr><th>Symbol</th><th>Health</th><th>Recommended action</th></tr>
        {rows_html}
      </table>
    </div>
    """


def get_digest_rows(db: Session, user: User) -> list[dict]:
    positions = (
        db.query(Position)
        .filter(Position.user_id == user.id, Position.status == PositionStatus.OPEN)
        .all()
    )

    rows = []
    for position in positions:
        latest = (
            db.query(Decision)
            .filter(Decision.position_id == position.id)
            .order_by(Decision.created_at.desc())
            .first()
        )
        if latest:
            rows.append(
                {
                    "symbol": position.symbol,
                    "health_score": latest.snapshot.health_score if latest.snapshot else "-",
                    "action": latest.action.value,
                }
            )
    return rows


def send_daily_digest(db: Session, user: User) -> bool:
    rows = get_digest_rows(db, user)
    html = build_digest_html(user, rows)
    return send_email(user.email, "Your daily PositionIQ digest", html)
