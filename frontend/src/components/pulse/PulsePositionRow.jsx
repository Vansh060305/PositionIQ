// One Market Pulse holding. Every value shown comes straight from the
// backend's GET /pulse/overview positions[] entry - no recalculation, no
// invented prices. The row links to the existing Position Detail page.
//
// Layout: on md+ the rows share a grid template with the table header so
// columns align like a real table; below md each row becomes a card with a
// 2x2 metric grid. Each metric cell carries its own label on mobile (hidden
// on md where the table header provides it).

import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus, ChevronRight, WifiOff } from "lucide-react";

const GRID = "md:grid-cols-[1.5fr_0.9fr_1.15fr_0.85fr_0.9fr]";

// Data-source markers are never color-only: text label + icon + chip.
const SOURCE_META = {
  LIVE: { label: "Live", chip: "bg-gain/10 text-gain", icon: null },
  STALE: { label: "Stale", chip: "bg-caution/10 text-caution", icon: WifiOff, title: "Live quote unavailable - last known market data" },
  NONE: { label: "No data", chip: "bg-surface-3 text-ink-muted", icon: WifiOff, title: "No live or stored market data" },
};

const TREND_META = {
  UP: { icon: ArrowUpRight, cls: "text-gain" },
  DOWN: { icon: ArrowDownRight, cls: "text-loss" },
  SIDEWAYS: { icon: Minus, cls: "text-ink-muted" },
};

function fmtMoney(v, sign = false) {
  if (v == null) return null;
  const abs = Math.abs(Number(v)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = v < 0 ? "-" : sign && v > 0 ? "+" : "";
  return `${prefix}$${abs}`;
}

function fmtPct(v, sign = false) {
  if (v == null) return null;
  const prefix = v > 0 && sign ? "+" : "";
  return `${prefix}${Number(v).toFixed(2)}%`;
}

function healthColor(score) {
  if (score == null) return "text-ink-faint";
  if (score >= 70) return "text-gain";
  if (score >= 40) return "text-caution";
  return "text-loss";
}

function pnlColor(v) {
  if (v == null) return "text-ink-faint";
  return v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-muted";
}

function dayColor(v) {
  if (v == null) return "text-ink-faint";
  return v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-ink-muted";
}

// Tiny caption shown above each value on mobile only (md+ has the header).
function CellLabel({ children }) {
  return (
    <span className="mb-1 block text-[9.5px] font-bold uppercase tracking-wider text-ink-faint md:hidden">
      {children}
    </span>
  );
}

function Dash({ text = "—" }) {
  return <span className="text-ink-faint">{text}</span>;
}

export default function PulsePositionRow({ position }) {
  const source = SOURCE_META[position.data_source] || SOURCE_META.NONE;
  const SourceIcon = source.icon;
  const trend = position.day_trend ? TREND_META[position.day_trend] : null;
  const TrendIcon = trend?.icon;

  const dayChange = position.change != null ? dayColor(position.change) : "";
  const dayPct = position.percent_change != null ? dayColor(position.percent_change) : "";
  const pnlClass = pnlColor(position.pnl_percent);
  const healthClass = healthColor(position.health_score);

  return (
    <Link
      to={`/positions/${position.position_id}`}
      className={`group relative grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border-soft bg-surface p-4 transition hover:border-accent/50 hover:bg-surface-raised/40 sm:p-5 md:grid md:items-center md:gap-x-3 md:py-3.5 ${GRID}`}
      aria-label={`Open ${position.symbol} position details`}
    >
      {/* Desktop affordance: chevron fades in on hover (not a column) */}
      <ChevronRight
        size={16}
        className="absolute right-4 top-1/2 hidden -translate-y-1/2 text-ink-faint opacity-0 transition group-hover:translate-x-0.5 group-hover:text-accent group-hover:opacity-100 md:block"
        aria-hidden
      />
      {/* Symbol + direction + data-source marker */}
      <div className="col-span-2 md:col-span-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            {position.symbol}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              position.position_type === "SHORT"
                ? "bg-caution/10 text-caution"
                : "bg-accent/10 text-accent"
            }`}
          >
            {position.position_type}
          </span>
          <span
            title={source.title}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${source.chip}`}
          >
            {SourceIcon && <SourceIcon size={10} />}
            {source.label}
          </span>
        </div>
        <p className="mt-0.5 hidden text-[11px] text-ink-faint md:block">
          {position.data_source === "LIVE"
            ? "Live Finnhub quote"
            : position.data_source === "STALE"
              ? "Last known market data"
              : "No market data available"}
        </p>
      </div>

      {/* Current price */}
      <div>
        <CellLabel>Current</CellLabel>
        <span className="font-mono text-sm font-semibold text-ink">
          {position.current_price != null ? fmtMoney(position.current_price) : <Dash />}
        </span>
      </div>

      {/* Day change ($ + % + trend, not color-only) */}
      <div>
        <CellLabel>Day change</CellLabel>
        {position.change == null && position.percent_change == null ? (
          <Dash />
        ) : (
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-sm">
            {position.change != null ? (
              <span className={`font-semibold ${dayChange}`}>{fmtMoney(position.change, true)}</span>
            ) : null}
            {position.percent_change != null ? (
              <span className={dayPct}>{fmtPct(position.percent_change, true)}</span>
            ) : null}
            {trend && TrendIcon ? (
              <TrendIcon
                size={13}
                className={trend.cls}
                aria-label={`Day trend ${position.day_trend}`}
              />
            ) : null}
          </span>
        )}
      </div>

      {/* P&L % - direction-aware, backend value shown verbatim */}
      <div>
        <CellLabel>P&amp;L</CellLabel>
        <span className={`font-mono text-sm font-bold ${pnlClass}`}>
          {position.pnl_percent != null ? fmtPct(position.pnl_percent, true) : <Dash />}
        </span>
      </div>

      {/* Health score */}
      <div>
        <CellLabel>Health</CellLabel>
        <span className={`font-mono text-sm font-bold ${healthClass}`}>
          {position.health_score != null ? `${Math.round(position.health_score)}/100` : <Dash />}
        </span>
      </div>

    </Link>
  );
}