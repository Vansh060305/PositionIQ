from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.dependencies import get_current_user
from models.user import User
from services.digest_service import send_daily_digest

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.post("/digest/send")
def send_digest_now(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Returns whether the email actually went out - False just means SMTP
    # isn't configured yet, not that something crashed
    sent = send_daily_digest(db, current_user)
    return {"sent": sent}
