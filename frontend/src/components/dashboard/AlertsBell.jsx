// Fetches alerts once on mount, then stays live via WebSocket pushes into
// the same store (see useWebSocket.js). Clicking an alert marks it read.
// NiveshMitra panel styling; logic unchanged.

import { useEffect, useState, useRef } from "react";
import { Bell, TrendingDown, ShieldAlert, TrendingUp, Mail } from "lucide-react";
import useAlertsStore from "../../store/alertsStore";
import { listAlerts, markAlertRead } from "../../api/alerts";

const ICONS = {
  HEALTH_DROP: TrendingDown,
  STOP_NEAR: ShieldAlert,
  TARGET_NEAR: TrendingUp,
  DIGEST: Mail,
};

export default function AlertsBell() {
  const alerts = useAlertsStore((s) => s.alerts);
  const setAlerts = useAlertsStore((s) => s.setAlerts);
  const markRead = useAlertsStore((s) => s.markRead);
  const [open, setOpen] = useState(false);
  const [alertsError, setAlertsError] = useState("");
  const panelRef = useRef(null);

  // A failed fetch is NOT "no alerts" - surface the real error with a retry
  // instead of showing a fake empty dropdown.
  async function loadAlerts() {
    setAlertsError("");
    try {
      setAlerts(await listAlerts());
    } catch (err) {
      setAlertsError(err.response?.data?.detail || "Couldn't load alerts. Try again.");
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [setAlerts]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleAlertClick(alert) {
    if (alert.is_read || alert.id.startsWith("live-")) {
      markRead(alert.id); // live-pushed alerts aren't in the DB by a real id yet
      return;
    }
    markRead(alert.id);
    try {
      await markAlertRead(alert.id);
    } catch {
      // non-critical - the alert still shows as read in this session
    }
  }

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => {
          setOpen((o) => !o);
          // Always re-fetch when the dropdown opens: the mount-time fetch can
          // predate an analysis run that just created alerts, and the WS
          // push may not have arrived yet.
          if (!open) loadAlerts();
        }}
        className="relative rounded-full border border-border bg-surface p-2.5 text-ink-muted transition hover:border-accent/50 hover:text-ink"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-loss px-1 text-[9px] font-bold text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-card-lg">
          <div className="border-b border-border-soft px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
            Alerts
          </div>
          <div className="max-h-80 overflow-y-auto">
            {alertsError ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-loss">{alertsError}</p>
                <button onClick={loadAlerts} className="btn-primary mt-3 px-4 py-1.5 text-xs">
                  Try again
                </button>
              </div>
            ) : alerts.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-faint">No alerts yet</p>
            ) : (
              alerts.map((alert) => {
                const Icon = ICONS[alert.type] || Bell;
                return (
                  <button
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`flex w-full items-start gap-3 border-b border-border-soft/60 px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-raised/60 ${
                      alert.is_read ? "opacity-50" : ""
                    }`}
                  >
                    <Icon size={15} className="mt-0.5 shrink-0 text-accent" />
                    <div>
                      <p className="text-[13px] text-ink">{alert.message}</p>
                      <p className="mt-1 text-[10.5px] text-ink-faint">
                        {new Date(alert.created_at).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}