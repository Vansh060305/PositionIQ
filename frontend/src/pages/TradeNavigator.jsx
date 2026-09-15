// Trade Navigator - "which of my open positions need attention right now?"
//
// Consumes GET /navigator/overview (backend-computed deterministic ranking)
// and renders it in the backend's exact order. The backend is the source of
// truth: the frontend never recalculates a score, invents a price, a tier
// or a reason, and it never overrides the ranking. Position cards link to
// the existing Position Detail page - no detail logic is duplicated here.

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Loader2, Compass, Layers, AlertTriangle, Eye, ShieldCheck } from "lucide-react";

import Topbar from "../components/dashboard/Topbar";
import NavigatorPositionCard from "../components/navigator/NavigatorPositionCard";
import { getNavigatorOverview } from "../api/navigator";

function fmtUpdatedAt(generatedAt) {
  if (!generatedAt) return "";
  const d = new Date(generatedAt);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function SummaryCard({ icon: Icon, label, value, valueClass = "" }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-btn-gradient text-white shadow-btn-glow">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className={`truncate font-display text-2xl font-bold ${valueClass || "bg-btn-gradient bg-clip-text text-transparent"}`}>
          {value}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </div>
      </div>
    </div>
  );
}

export default function TradeNavigator() {
  const [data, setData] = useState(null); // { positions, generated_at }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!background) setError("");
    if (background) setRefreshing(true);
    return getNavigatorOverview().then(
      (result) => {
        setData(result);
        setError("");
        return result;
      },
      (err) => {
        // A failed fetch is NOT an empty navigator - surface the real error
        setError(err.response?.data?.detail || "Couldn't load Trade Navigator. Try again.");
        return null;
      }
    );
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRefresh() {
    await load(true);
    setRefreshing(false);
  }

  const positions = data?.positions ?? [];
  const counts = {
    total: positions.length,
    high: positions.filter((p) => p.attention_tier === "HIGH ATTENTION").length,
    watch: positions.filter((p) => p.attention_tier === "WATCH").length,
    healthy: positions.filter((p) => p.attention_tier === "HEALTHY").length,
  };

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Trade Navigator</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              Every open position ranked by how much attention it needs right now -
              powered by the same deterministic score and decision engine used
              throughout PositionIQ.
            </p>
            <p className="mt-1.5 text-xs text-ink-faint">
              {data?.generated_at
                ? `Updated ${fmtUpdatedAt(data.generated_at)}`
                : "Decision support only - no orders are ever placed."}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh ranking and live prices"
            className="btn-ghost px-3.5 py-2.5 text-sm"
          >
            {refreshing ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <p className="mt-10 text-sm text-ink-faint">Loading Navigator…</p>
        ) : error ? (
          /* API/network failure - never render as an empty state */
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{error}</p>
            <button onClick={handleRefresh} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        ) : positions.length === 0 ? (
          /* Genuinely no open positions */
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-20 text-center">
            <span className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full border border-border-soft bg-surface-raised text-accent shadow-[0_0_24px_rgba(138,180,248,0.25)]">
              <Compass size={30} strokeWidth={2} />
            </span>
            <h3 className="mt-6 font-display text-xl font-bold text-ink">
              No open positions to review
            </h3>
            <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
              Once you add open positions, Trade Navigator will show you exactly
              which ones need attention first.
            </p>
            <Link to="/dashboard" className="btn-primary mt-7 px-6 py-2.5 text-sm">
              Go to your positions
            </Link>
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="mb-8 mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryCard icon={Layers} label="Open positions" value={counts.total} />
              <SummaryCard
                icon={AlertTriangle}
                label="High attention"
                value={counts.high}
                valueClass={counts.high ? "text-loss" : "text-ink-muted"}
              />
              <SummaryCard
                icon={Eye}
                label="Watch"
                value={counts.watch}
                valueClass={counts.watch ? "text-caution" : "text-ink-muted"}
              />
              <SummaryCard
                icon={ShieldCheck}
                label="Healthy"
                value={counts.healthy}
                valueClass={counts.healthy ? "text-gain" : "text-ink-muted"}
              />
            </div>

            {/* Priority list - backend order is authoritative, render as-is */}
            <div className="flex flex-col gap-4">
              {positions.map((position, index) => (
                <NavigatorPositionCard key={position.position_id} position={position} index={index} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}