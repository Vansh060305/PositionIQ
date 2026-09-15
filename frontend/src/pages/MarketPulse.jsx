// Market Pulse - "what is the condition of my open holdings right now?"
//
// Renders the backend's GET /pulse/overview response faithfully. The backend
// is the source of truth: status, headline, reasons, counts, health values,
// exposure and per-position data are displayed exactly as returned. The
// frontend never recalculates a pulse or health score, never re-derives the
// status, and never invents market-wide data. This is explicitly "Your
// Holdings Market Pulse" - not a fabricated stock-market dashboard.

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Loader2,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Layers,
  WifiOff,
  HeartPulse,
  Scale,
  Gauge,
  Wallet,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import Topbar from "../components/dashboard/Topbar";
import PulsePositionRow from "../components/pulse/PulsePositionRow";
import { getPulseOverview } from "../api/pulse";

// Status visuals carry icon + text + color together - never color alone.
const STATUS_META = {
  POSITIVE: {
    icon: TrendingUp,
    badge: "bg-gain/10 text-gain",
    ring: "border-gain/30",
    glow: "shadow-[0_0_28px_rgba(129,201,149,0.15)]",
    label: "Positive",
  },
  NEUTRAL: {
    icon: Activity,
    badge: "bg-accent/10 text-accent",
    ring: "border-accent/30",
    glow: "shadow-[0_0_28px_rgba(138,180,248,0.15)]",
    label: "Neutral",
  },
  CAUTION: {
    icon: AlertTriangle,
    badge: "bg-caution/10 text-caution",
    ring: "border-caution/30",
    glow: "shadow-[0_0_28px_rgba(253,214,99,0.15)]",
    label: "Caution",
  },
  NEGATIVE: {
    icon: ShieldAlert,
    badge: "bg-loss/10 text-loss",
    ring: "border-loss/30",
    glow: "shadow-[0_0_28px_rgba(242,139,130,0.15)]",
    label: "Negative",
  },
};

const NO_DATA_META = {
  icon: WifiOff,
  badge: "bg-surface-3 text-ink-muted",
  ring: "border-border-soft",
  glow: "",
  label: "No data",
};

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

function fmtMoney(v) {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Summary tile for the top metric row + the holdings metric strip.
function MetricTile({ icon: Icon, label, value, valueClass = "text-ink", hint }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-btn-gradient text-white shadow-btn-glow">
        <Icon size={19} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <div className={`truncate font-display text-2xl font-bold ${valueClass}`}>{value}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          {label}
        </div>
        {hint && <div className="mt-0.5 truncate text-[10.5px] text-ink-faint/80">{hint}</div>}
      </div>
    </div>
  );
}

// Segmented breadth bar - widths are pure count/total ratios of the exact
// backend counts. Labels + icons accompany every segment (not color-only).
function BreadthBar({ label, caption, segments }) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink">
          {label}
        </h3>
        {caption && <span className="text-[11px] text-ink-faint">{caption}</span>}
      </div>
      {total > 0 ? (
        <>
          <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-raised" role="img" aria-label={label}>
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <div
                  key={s.label}
                  style={{ width: `${(s.count / total) * 100}%`, background: s.color }}
                  title={`${s.label}: ${s.count}`}
                />
              ))}
          </div>
          <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-2">
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <li key={s.label} className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  <s.icon size={12} className={s.iconCls || "text-ink-faint"} />
                  <span className="font-semibold text-ink">{s.count}</span> {s.label}
                </li>
              ))}
          </ul>
        </>
      ) : (
        <p className="mt-3 text-xs text-ink-faint">No data to show yet.</p>
      )}
    </div>
  );
}

function PulseSkeleton() {
  return (
    <div className="mt-8 space-y-4" aria-busy="true" aria-label="Loading market pulse">
      <div className="h-40 animate-pulse rounded-2xl bg-surface-raised/60" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-raised/60" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface-raised/60" />
    </div>
  );
}

export default function MarketPulse() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (background = false) => {
    if (!background) setError("");
    if (background) setRefreshing(true);
    return getPulseOverview().then(
      (result) => {
        setData(result);
        setError("");
        return result;
      },
      (err) => {
        // A failed request is NOT an empty pulse - surface the real error
        setError(err.response?.data?.detail || "Couldn't load Market Pulse. Try again.");
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

  const status = data?.pulse_status ?? null;
  const meta = status ? STATUS_META[status] : NO_DATA_META;
  const StatusIcon = meta.icon;
  const positions = data?.positions ?? [];
  const total = data?.total_open_positions ?? 0;

  // Summary metrics - all direct backend values.
  const summary = [
    { icon: Layers, label: "Open positions", value: total, valueClass: "bg-btn-gradient bg-clip-text text-transparent" },
    { icon: TrendingUp, label: "Up today", value: data?.symbols_up_today ?? 0, valueClass: "text-gain", hint: "live quotes" },
    { icon: TrendingDown, label: "Down today", value: data?.symbols_down_today ?? 0, valueClass: "text-loss", hint: "live quotes" },
    { icon: Minus, label: "Flat today", value: data?.symbols_flat_today ?? 0, valueClass: "text-ink-muted", hint: "live quotes" },
  ];

  // Holdings metric strip (values may be null -> "—").
  const holdings = [
    { icon: ShieldCheck, label: "Avg health", value: data?.avg_health_score != null ? `${Math.round(data.avg_health_score)}/100` : "—" },
    { icon: Scale, label: "Weighted health", value: data?.exposure_weighted_health != null ? `${Math.round(data.exposure_weighted_health)}/100` : "—" },
    { icon: Gauge, label: "Avg volatility", value: data?.avg_volatility != null ? `${data.avg_volatility.toFixed(1)}%` : "—" },
    { icon: Wallet, label: "Total exposure", value: fmtMoney(data?.total_exposure) },
    { icon: PieChart, label: "Diversification", value: data?.diversification_score != null ? `${Math.round(data.diversification_score)}%` : "—" },
  ];

  const pnlSegments = [
    { label: "in profit", count: data?.positions_up ?? 0, color: "#81c995", icon: ArrowUpRight, iconCls: "text-gain" },
    { label: "in a loss", count: data?.positions_down ?? 0, color: "#f28b82", icon: ArrowDownRight, iconCls: "text-loss" },
    { label: "flat", count: data?.positions_flat ?? 0, color: "#9aa0a6", icon: Minus },
    { label: "no data", count: data?.positions_unknown ?? 0, color: "#3c4043", icon: WifiOff },
  ];

  // Day-change breadth only covers LIVE quotes; positions without a live
  // quote (stale/none) get a transparent "no live quote" segment.
  const liveTotal = (data?.symbols_up_today ?? 0) + (data?.symbols_down_today ?? 0) + (data?.symbols_flat_today ?? 0);
  const noLiveQuote = Math.max(0, total - liveTotal);
  const daySegments = [
    { label: "up today", count: data?.symbols_up_today ?? 0, color: "#81c995", icon: ArrowUpRight, iconCls: "text-gain" },
    { label: "down today", count: data?.symbols_down_today ?? 0, color: "#f28b82", icon: ArrowDownRight, iconCls: "text-loss" },
    { label: "flat today", count: data?.symbols_flat_today ?? 0, color: "#9aa0a6", icon: Minus },
    { label: "no live quote", count: noLiveQuote, color: "#3c4043", icon: WifiOff },
  ];

  return (
    <div className="min-h-screen">
      <Topbar />

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
              {data?.market_scope || "Holdings intelligence"}
            </p>
            <h1 className="mt-1 font-display text-2xl font-bold text-ink">Market Pulse</h1>
            <p className="mt-1 max-w-xl text-sm text-ink-muted">
              A truthful, read-only pulse of your open holdings - built from live
              quotes and PositionIQ's deterministic analysis. No invented
              market-wide data, no trading signals.
            </p>
            <p className="mt-1.5 text-xs text-ink-faint">
              {data?.generated_at ? `Updated ${fmtUpdatedAt(data.generated_at)}` : "Waiting for market data…"}
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            title="Refresh pulse and live prices"
            className="btn-ghost px-3.5 py-2.5 text-sm"
          >
            {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <PulseSkeleton />
        ) : error ? (
          /* API/network failure - never render as an empty pulse */
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{error}</p>
            <button onClick={handleRefresh} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        ) : total === 0 ? (
          /* Genuinely no open positions */
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-20 text-center">
            <span className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full border border-border-soft bg-surface-raised text-accent shadow-[0_0_24px_rgba(138,180,248,0.25)]">
              <HeartPulse size={30} strokeWidth={2} />
            </span>
            <h3 className="mt-6 font-display text-xl font-bold text-ink">No open positions to pulse</h3>
            <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
              Add open positions and Market Pulse will show you the real
              condition of your holdings at a glance.
            </p>
            <Link to="/dashboard" className="btn-primary mt-7 px-6 py-2.5 text-sm">
              Go to your positions
            </Link>
          </div>
        ) : (
          <>
            {/* Primary pulse card */}
            <section
              aria-label="Holdings pulse"
              className={`mt-8 rounded-2xl border bg-surface p-6 ${meta.ring} ${meta.glow} sm:p-8`}
            >
              <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest ${meta.badge}`}
                    >
                      <StatusIcon size={14} />
                      {status ? meta.label : "Unavailable"}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                      Holdings market signal
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-xl font-bold leading-snug text-ink sm:text-2xl">
                    {data?.headline || "No signal available"}
                  </h2>
                </div>
              </div>
              {(data?.reasons || []).length > 0 && (
                <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                  {data.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="flex items-start gap-2 rounded-xl border border-border-soft bg-base/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-muted"
                    >
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-btn-gradient" />
                      {reason}
                    </li>
                  ))}
                </ul>
              )}
              {!status && (
                <p className="mt-4 max-w-xl text-xs text-ink-faint">
                  The pulse cannot be computed without market data. Retry once
                  live quotes are available - PositionIQ never guesses a signal.
                </p>
              )}
            </section>

            {/* Summary metrics */}
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {summary.map((s) => (
                <MetricTile key={s.label} {...s} />
              ))}
            </div>

            {/* Holdings metric strip */}
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
              {holdings.map((s) => (
                <div key={s.label} className="rounded-xl border border-border-soft bg-surface/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <s.icon size={13} className="shrink-0 text-ink-faint" />
                    <span className="truncate text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                      {s.label}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-ink">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Breadth */}
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <BreadthBar
                label="Position breadth · P&L"
                caption="direction-aware · since entry"
                segments={pnlSegments}
              />
              <BreadthBar
                label="Today's move · live"
                caption="day change vs previous close"
                segments={daySegments}
              />
            </div>

            {/* Holdings list */}
            <section className="mt-10" aria-label="Holdings detail">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-ink">Your holdings</h3>
                <span className="text-[11px] text-ink-faint">
                  Real prices · click a holding for full analysis
                </span>
              </div>

              {/* Desktop column headers - aligned with PulsePositionRow's grid */}
              <div className="mt-3 hidden gap-x-3 border-b border-border-soft px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-ink-faint md:grid md:grid-cols-[1.5fr_0.9fr_1.15fr_0.85fr_0.9fr]">
                <span>Symbol</span>
                <span>Current</span>
                <span>Day change</span>
                <span>P&amp;L</span>
                <span>Health</span>
              </div>

              <div className="mt-2 flex flex-col gap-3">
                {positions.map((position) => (
                  <PulsePositionRow key={position.position_id} position={position} />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}