# This file is the ONLY place that talks to the Finnhub API.
# If we ever swap market data providers, this is the only file that changes -
# routes and other services never call Finnhub directly.

import requests
from fastapi import HTTPException, status

from core.config import settings

FINNHUB_BASE_URL = "https://finnhub.io/api/v1"


def get_quote(symbol: str) -> dict:
    # Calls Finnhub's /quote endpoint for one stock symbol, e.g. "AAPL"

    if not settings.finnhub_api_key:
        # Fails clearly instead of silently returning empty data
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market data is not configured - set FINNHUB_API_KEY in .env",
        )

    try:
        response = requests.get(
            f"{FINNHUB_BASE_URL}/quote",
            params={"symbol": symbol.upper(), "token": settings.finnhub_api_key},
            timeout=5,
        )
    except requests.exceptions.RequestException:
        # Network failure (no internet, DNS, timeout) - would otherwise
        # surface as a raw, unhandled 500
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not reach Finnhub - check your internet connection",
        )

    if response.status_code == 401:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Finnhub rejected the API key - double check FINNHUB_API_KEY in .env",
        )

    if response.status_code == 429:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Finnhub rate limit hit - wait a moment and try again",
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not fetch market data right now (Finnhub returned {response.status_code})",
        )

    data = response.json()

    # Finnhub returns all-zero fields for a symbol it doesn't recognize
    # instead of a real error - we turn that into a clean 404 ourselves.
    if data.get("c") in (0, None) and data.get("pc") in (0, None):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No market data found for symbol '{symbol.upper()}'",
        )

    # Translate Finnhub's short field names (c, o, h, l...) into readable ones
    return {
        "symbol": symbol.upper(),
        "current_price": data.get("c"),
        "open": data.get("o"),
        "high": data.get("h"),
        "low": data.get("l"),
        "previous_close": data.get("pc"),
        "change": data.get("d"),
        "percent_change": data.get("dp"),
    }
