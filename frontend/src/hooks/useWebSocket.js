// Mounted once (in App.jsx) so the whole app shares a single WebSocket
// connection instead of each page opening its own. Reconnects automatically
// if the connection drops for a transient reason - but NOT when the server
// rejects the token (4401/1008), which would otherwise retry forever and
// spam the backend every 5 seconds with a bad credential.

import { useEffect } from "react";
import useAuthStore from "../store/authStore";
import useLiveStore from "../store/liveStore";
import useAlertsStore from "../store/alertsStore";

export default function useWebSocket() {
  const token = useAuthStore((s) => s.token);
  const setLiveDecision = useLiveStore((s) => s.setLiveDecision);
  const addLiveAlert = useAlertsStore((s) => s.addLiveAlert);

  useEffect(() => {
    if (!token) return;

    const wsBase = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000";
    let socket;
    let reconnectTimer;
    let cancelled = false;

    function connect() {
      socket = new WebSocket(`${wsBase}/ws/positions?token=${token}`);

      socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "decision_update") {
            // Store the whole payload - action/confidence plus the fresh
            // market data (current price, P&L %, score) and the backend
            // timestamp, so the UI can apply it directly to React state.
            setLiveDecision(msg.position_id, msg);
          } else if (msg.type === "alert") {
            addLiveAlert(msg);
          }
        } catch {
          // ignore malformed frames - the backend only sends JSON
        }
      };

      socket.onclose = (event) => {
        if (cancelled) return;

        // 4401 (custom "bad token") and 1008 (policy violation) mean the
        // server rejected our credential - the token is expired/invalid.
        // Reconnecting on a timer would never succeed, so stop and log out.
        if (event.code === 4401 || event.code === 1008) {
          useAuthStore.getState().logout();
          return;
        }

        reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token, setLiveDecision, addLiveAlert]);
}
