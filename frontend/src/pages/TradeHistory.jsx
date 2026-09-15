// Closed positions with realized P&L - the other half of the position
// lifecycle that a Dashboard showing only OPEN positions can't show.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";

import Topbar from "../components/dashboard/Topbar";
import { listPositions } from "../api/positions";

export default function TradeHistory() {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setError("");
    return listPositions("CLOSED").then(
      (data) => setTrades(data),
      (err) => {
        // A failed fetch is NOT an empty history - surface the real error
        setError(err.response?.data?.detail || "Couldn't load your trade history. Try again.");
      }
    );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalRealized = trades.reduce((sum, t) => sum + (t.realized_pnl || 0), 0);
  const winCount = trades.filter((t) => t.realized_pnl > 0).length;
  const winRate = trades.length ? Math.round((winCount / trades.length) * 100) : 0;

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Trade history</h1>
        <p className="mt-1 text-sm text-ink-muted">{trades.length} closed positions</p>

        {!loading && trades.length > 0 && (
          <div className="mb-8 mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                Total realized P&amp;L
              </div>
              <div
                className={`mt-2 font-display text-2xl font-bold ${
                  totalRealized >= 0 ? "text-gain" : "text-loss"
                }`}
              >
                {totalRealized >= 0 ? "+" : ""}${totalRealized.toFixed(2)}
              </div>
            </div>
            <div className="card p-5">
              <div className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                Win rate
              </div>
              <div className="mt-2 bg-btn-gradient bg-clip-text font-display text-2xl font-bold text-transparent">
                {winRate}%
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="mt-8 text-sm text-ink-faint">Loading…</p>
        ) : error && trades.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{error}</p>
            <button onClick={load} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        ) : trades.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <History size={26} className="text-ink-faint" />
            <h3 className="mt-4 font-display text-lg font-bold text-ink">
              No closed positions yet
            </h3>
            <p className="mt-1 max-w-xs text-sm text-ink-muted">
              Once you close a position, it shows up here with its realized P&amp;L.
            </p>
          </div>
        ) : (
          <div className="card mt-8 overflow-hidden">
            {/* Header and rows share one scroll container so columns stay
                aligned when the table overflows on narrow screens. */}
            <div className="overflow-x-auto">
              <div className="w-full min-w-[720px]">
                <div className="grid grid-cols-[1.2fr,1fr,1fr,0.8fr,1fr,1fr] gap-3 border-b border-border-soft bg-base/40 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  <div>Symbol</div>
                  <div>Entry</div>
                  <div>Exit</div>
                  <div>Qty</div>
                  <div>Realized P&amp;L</div>
                  <div>Closed</div>
                </div>
                {trades.map((t) => (
                  <Link
                    key={t.id}
                    to={`/positions/${t.id}`}
                    className="grid grid-cols-[1.2fr,1fr,1fr,0.8fr,1fr,1fr] items-center gap-3 border-b border-border-soft px-5 py-4 text-sm transition last:border-b-0 hover:bg-surface-raised/60"
                  >
                    <div className="font-display font-bold text-ink">{t.symbol}</div>
                    <div className="font-medium text-ink-muted">${t.entry_price?.toFixed(2)}</div>
                    <div className="font-medium text-ink-muted">${t.exit_price?.toFixed(2)}</div>
                    <div className="font-medium text-ink-muted">{t.quantity}</div>
                    <div
                      className={`font-semibold ${
                        t.realized_pnl >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {t.realized_pnl >= 0 ? "+" : ""}${t.realized_pnl?.toFixed(2)}
                    </div>
                    <div className="text-xs text-ink-faint">
                      {new Date(t.closed_at).toLocaleDateString()}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}