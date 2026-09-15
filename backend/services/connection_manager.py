# In-memory registry of who's currently connected over WebSocket, keyed by
# user id. Good enough for a single-process dev/demo setup - a real
# multi-instance production deployment would use Redis pub/sub instead so
# every server instance shares the same connection list.

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, user_id: str, websocket: WebSocket):
        conns = self.active_connections.get(user_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns and user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_to_user(self, user_id: str, message: dict):
        # A user can have multiple tabs open - push to all of them. A send
        # that raises means the socket died (tab closed / network dropped)
        # before its disconnect event arrived - drop it now instead of
        # retrying every tick forever on a dead connection.
        conns = self.active_connections.get(user_id, [])
        alive = []
        for ws in list(conns):
            try:
                await ws.send_json(message)
                alive.append(ws)
            except Exception:
                pass  # gone - excluded from the next broadcast
        if alive:
            self.active_connections[user_id] = alive
        elif user_id in self.active_connections:
            del self.active_connections[user_id]

    def connected_user_ids(self) -> list[str]:
        return list(self.active_connections.keys())


# One shared instance for the whole app - routes and the background
# broadcaster both import this same object.
manager = ConnectionManager()
