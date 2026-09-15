# Lets the frontend (and Phase 6 health engine) check a live price for a symbol.
# Requires login, same as every other business route in this app.

from fastapi import APIRouter, Depends

from core.dependencies import get_current_user
from models.user import User
from schemas.market import QuoteOut
from services import market_data

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/quote/{symbol}", response_model=QuoteOut)
def get_quote(symbol: str, current_user: User = Depends(get_current_user)):
    return market_data.get_quote(symbol)
