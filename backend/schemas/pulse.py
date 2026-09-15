# Shape of the Market Pulse response sent to the frontend.
#
# Market Pulse is intentionally scoped to the user's OWN holdings - the
# current Finnhub integration only provides quote-level data, so no
# market-wide breadth/index/volume metrics are ever invented here.

import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class PulsePositionOut(BaseModel):
    position_id: uuid.UUID  # lets the frontend link straight to the Position Detail page
    symbol: str
    position_type: str  # LONG / SHORT
    quantity: int
    current_price: Optional[float]
    change: Optional[float]  # day change ($), from the live quote
    percent_change: Optional[float]  # day change (%), from the live quote
    day_trend: Optional[str]  # UP / DOWN / SIDEWAYS
    pnl_percent: Optional[float]  # direction-aware unrealized P&L %
    health_score: Optional[float]
    # LIVE = fresh Finnhub quote; STALE = live quote failed, last real stored
    # snapshot shown; NONE = no live quote and no stored snapshot.
    data_source: str


class PulseOverviewOut(BaseModel):
    # Explicit scope: this pulse describes the user's holdings, not the
    # whole market (quote-level Finnhub data only).
    market_scope: str
    # POSITIVE / NEUTRAL / CAUTION / NEGATIVE; None when there is no data
    # (no positions, or no market data at all) to base a pulse on.
    pulse_status: Optional[str]
    headline: Optional[str]  # one-line summary of the pulse
    reasons: List[str]  # deterministic, human-readable driving factors

    total_open_positions: int
    positions_up: int  # in profit (direction-aware P&L)
    positions_down: int  # in a loss
    positions_flat: int  # P&L within the +/-0.2% dead zone
    positions_unknown: int  # no live or stored market data at all

    # Day-change breadth - counts only LIVE quotes (stale data is never
    # presented as today's movement).
    symbols_up_today: int
    symbols_down_today: int
    symbols_flat_today: int

    avg_health_score: Optional[float]  # simple mean across positions with data
    exposure_weighted_health: Optional[float]  # weighted by cost basis
    avg_volatility: Optional[float]  # mean intraday high-low range %

    total_exposure: float  # cost basis, from the existing portfolio service
    diversification_score: float  # 0-100, from the existing portfolio service

    positions: List[PulsePositionOut]
    generated_at: datetime