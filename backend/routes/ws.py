# Streams live decision updates for a user's open positions.
# The actual periodic push comes from background_tasks.py - this file only
# handles the connection lifecycle and an initial "catch up" push of
# whatever the latest known decisions already are (no new Finnhub calls
# here, so just opening/refreshing the page doesn't burn API quota).

import uuid
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from core.database import SessionLocal
from core.security import decode_access_token
from models.user import User
from models.position import Position, PositionStatus
from models.decision import Decision
from services.connection_manager import manager
from services.background_tasks import build_live_payload

router = APIRouter()


@router.websocket("/ws/positions")
async def positions_ws(websocket: WebSocket, token: str = Query(...)):
    payload = decode_access_token(token)
    if payload is None:
        await websocket.close(code=4401)
        return

    raw_user_id = payload.get("sub")
    if not raw_user_id:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == uuid.UUID(raw_user_id)).first()
        if user is None or not user.is_active:
            await websocket.close(code=4401)
            return

        await manager.connect(raw_user_id, websocket)

        # Initial sync: send whatever decisions already exist, so the UI
        # isn't blank while waiting for the next broadcast tick. Same payload
        # shape as the periodic push - no new Finnhub calls happen here.
        positions = (
            db.query(Position)
            .filter(Position.user_id == user.id, Position.status == PositionStatus.OPEN)
            .all()
        )
        for position in positions:
            latest = (
                db.query(Decision)
                .filter(Decision.position_id == position.id)
                .order_by(Decision.created_at.desc())
                .first()
            )
            if latest:
                await websocket.send_json(build_live_payload(position, latest))
    finally:
        db.close()

    try:
        while True:
            # We don't expect messages from the client - this just blocks
            # until the browser closes the tab/connection
            await websocket.receive_text()
    except Exception:
        # WebSocketDisconnect and any transport error both mean the
        # connection is gone - make sure it leaves the registry so the
        # broadcaster doesn't keep pushing to a dead socket.
        manager.disconnect(raw_user_id, websocket)
