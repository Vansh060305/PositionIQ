import { useEffect, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Plus, RefreshCw, Loader2 } from "lucide-react";

import Topbar from "../components/dashboard/Topbar";
import StatsOverview from "../components/dashboard/StatsOverview";
import PositionTable from "../components/dashboard/PositionTable";
import EmptyState from "../components/dashboard/EmptyState";
import AddPositionForm from "../components/dashboard/AddPositionForm";
import { listPositions } from "../api/positions";
import { getPortfolioSummary } from "../api/portfolio";
import { generateDecision } from "../api/decisions";
import { getHealthHistory } from "../api/health";

// The backend broadcaster re-analyzes open positions every 60s, so a
// dashboard poll on the same cadence only READS the latest saved snapshot
// (no extra Finnhub calls, no extra writes).
const ANALYZE_INTERVAL_MS = 60000;

// Fresh analysis for one position: run the backend decision engine (fresh
// Finnhub price + score + action) and pair it with the newest saved health
// snapshot (score, current price, P&L%) - all backend-computed values.
async function analyzePosition(position) {
  try {
    const decision = await generateDecision(position.id);
    const history = await getHealthHistory(position.id);
    const snap = history[0];
    return {
      id: position.id,
      status: "ok",
      action: decision.action,
      score: snap ? snap.health_score : null,
      currentPrice: snap ? snap.current_price : null,
      pnlPercent: snap ? snap.pnl_percent : null,
    };
  } catch (err) {
    return {
      id: position.id,
      status: "error",
      message: err.response?.data?.detail || "Analysis unavailable",
    };
  }
}

// Cheap poll: re-read only the latest saved snapshot (no decision run).
async function readLatestSnapshot(position) {
  try {
    const history = await getHealthHistory(position.id);
    const snap = history[0];
    if (!snap) {
      return { id: position.id, status: "error", message: "No analysis yet" };
    }
    return {
      id: position.id,
      status: "ok",
      score: snap.health_score,
      currentPrice: snap.current_price,
      pnlPercent: snap.pnl_percent,
    };
  } catch (err) {
    return {
      id: position.id,
      status: "error",
      message: err.response?.data?.detail || "Analysis unavailable",
    };
  }
}

function errorDetail(err, fallback) {
  return err?.response?.data?.detail || fallback;
}

export default function Dashboard() {
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [analyses, setAnalyses] = useState({}); // { [positionId]: {status, ...} }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summaryError, setSummaryError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Full refresh: fresh decisions + snapshots for every open position.
  const runFreshAnalyses = useCallback(async (posList) => {
    const results = await Promise.allSettled(posList.map(analyzePosition));
    const next = {};
    posList.forEach((p, i) => {
      next[p.id] =
        results[i].status === "fulfilled"
          ? results[i].value
          : { id: p.id, status: "error", message: "Analysis unavailable" };
    });
    setAnalyses(next);
  }, []);

  // Interval poll: refresh score/price/P&L from the latest saved snapshot.
  // A transient failure keeps whatever good data we already had instead of
  // flashing the row to an error state.
  const refreshStaleAnalyses = useCallback(async (posList) => {
    const results = await Promise.allSettled(posList.map(readLatestSnapshot));
    setAnalyses((prev) => {
      const next = { ...prev };
      posList.forEach((p, i) => {
        const r = results[i];
        const id = p.id;
        const prevOk = next[id] && next[id].status === "ok";
        if (r.status === "fulfilled" && r.value.status === "ok") {
          next[id] = {
            ...(prevOk ? next[id] : { id }),
            status: "ok",
            score: r.value.score,
            currentPrice: r.value.currentPrice,
            pnlPercent: r.value.pnlPercent,
          };
        } else if (!prevOk) {
          next[id] = { id, status: "error", message: "Analysis unavailable" };
        }
      });
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setError("");
    setSummaryError("");
    setRefreshing(true);
    let posList = [];
    try {
      posList = await listPositions("OPEN");
      setPositions(posList);
    } catch (err) {
      setError(errorDetail(err, "Couldn't load your positions. Try again."));
    }
    try {
      setSummary(await getPortfolioSummary());
    } catch (err) {
      setSummaryError(errorDetail(err, "Couldn't load your portfolio summary."));
    }
    if (posList.length > 0) {
      await runFreshAnalyses(posList);
    } else {
      setAnalyses({});
    }
    setRefreshing(false);
  }, [runFreshAnalyses]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // Keep prices/scores current while the page is open - the backend
  // broadcaster saves a fresh snapshot every 60s, we just read it.
  useEffect(() => {
    if (!positions.length) return undefined;
    const timer = setInterval(() => refreshStaleAnalyses(positions), ANALYZE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [positions, refreshStaleAnalyses]);

  async function handleCreated(newPosition) {
    setPositions((prev) => [newPosition, ...prev]);
    setShowAddForm(false);
    getPortfolioSummary().then(setSummary).catch(() => {});
    const result = await analyzePosition(newPosition);
    setAnalyses((prev) => ({ ...prev, [newPosition.id]: result }));
  }

  // Live totals derived from the same backend analyses the table shows.
  const analyzedPositions = positions.filter((p) => analyses[p.id]?.status === "ok");
  const hasLiveData = analyzedPositions.length > 0;
  const portfolioValue = analyzedPositions.reduce(
    (sum, p) => sum + analyses[p.id].currentPrice * p.quantity,
    0
  );
  const totalPnl = analyzedPositions.reduce(
    (sum, p) => sum + (analyses[p.id].pnlPercent / 100) * p.entry_price * p.quantity,
    0
  );
  const costBasis = analyzedPositions.reduce(
    (sum, p) => sum + p.entry_price * p.quantity,
    0
  );
  const totalPnlPct = costBasis > 0 ? (totalPnl / costBasis) * 100 : 0;

  const stats = {
    positionCount: summary?.position_count ?? positions.length,
    portfolioValue: hasLiveData ? portfolioValue : null,
    totalPnl: hasLiveData ? totalPnl : null,
    totalPnlPct: hasLiveData ? totalPnlPct : null,
    diversification: summary?.diversification_score,
  };

  const showBanner = (error && positions.length > 0) || summaryError;

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Your positions</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {positions.length} open {positions.length === 1 ? "position" : "positions"}
            </p>
          </div>
          {positions.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                disabled={refreshing}
                title="Refresh live prices and scores"
                className="btn-ghost px-3.5 py-2.5 text-sm"
              >
                {refreshing ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <RefreshCw size={15} />
                )}
              </button>
              <button
                onClick={() => setShowAddForm((s) => !s)}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                <Plus size={15} />
                Add position
              </button>
            </div>
          )}
        </div>

        {!loading && positions.length > 0 && <StatsOverview stats={stats} />}

        {showBanner && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface-raised px-4 py-3">
            <p className="text-xs text-loss">{error || summaryError}</p>
            <button onClick={refresh} className="btn-primary px-4 py-1.5 text-xs">
              Retry
            </button>
          </div>
        )}

        <AnimatePresence>
          {showAddForm && (
            <div className="mb-6">
              <AddPositionForm onCreated={handleCreated} onClose={() => setShowAddForm(false)} />
            </div>
          )}
        </AnimatePresence>

        {loading ? (
          <p className="text-sm text-ink-faint">Loading positions...</p>
        ) : error && positions.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{error}</p>
            <button onClick={refresh} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        ) : positions.length === 0 && !showAddForm ? (
          <EmptyState onAddClick={() => setShowAddForm(true)} />
        ) : (
          <PositionTable positions={positions} analyses={analyses} />
        )}
      </main>
    </div>
  );
}