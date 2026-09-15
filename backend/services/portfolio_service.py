# Computes sector-wise exposure and a diversification score across a
# user's OPEN positions. Uses cost basis (entry_price * quantity) as each
# position's weight instead of live prices - this avoids extra Finnhub
# calls just to render a dashboard summary, which matters on the free
# tier's 60-calls/minute limit.

from collections import defaultdict
from sqlalchemy.orm import Session

from models.position import Position, PositionStatus
from models.user import User, UserRole


def get_portfolio_summary(db: Session, user: User) -> dict:
    # Same visibility rule as position_service: USER sees only their own,
    # ANALYST/ADMIN see everyone's
    query = db.query(Position).filter(Position.status == PositionStatus.OPEN)
    if user.role == UserRole.USER:
        query = query.filter(Position.user_id == user.id)
    positions = query.all()

    if not positions:
        return {
            "total_exposure": 0.0,
            "sector_breakdown": [],
            "diversification_score": 0.0,
            "position_count": 0,
        }

    sector_exposure = defaultdict(float)
    total_exposure = 0.0

    for position in positions:
        value = position.entry_price * position.quantity
        sector = position.sector or "Unclassified"  # positions without a sector still count
        sector_exposure[sector] += value
        total_exposure += value

    sector_breakdown = []
    hhi = 0.0  # Herfindahl-Hirschman Index - standard concentration measure

    for sector, value in sorted(sector_exposure.items(), key=lambda item: -item[1]):
        share = value / total_exposure if total_exposure else 0
        hhi += share**2
        sector_breakdown.append(
            {
                "sector": sector,
                "exposure": round(value, 2),
                "percent": round(share * 100, 2),
            }
        )

    # HHI ranges from 1/n (spread evenly across n sectors) to 1 (all in one
    # sector). We flip it to (1 - HHI) * 100 so a HIGHER number means MORE
    # diversified - that reads better on a dashboard than a raw HHI value.
    diversification_score = round((1 - hhi) * 100, 2)

    return {
        "total_exposure": round(total_exposure, 2),
        "sector_breakdown": sector_breakdown,
        "diversification_score": diversification_score,
        "position_count": len(positions),
    }
