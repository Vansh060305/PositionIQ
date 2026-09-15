// One Trade Navigator priority card. Everything shown comes straight from
// the backend's GET /navigator/overview response - the backend is the source
// of truth for the attention score, tier, prices, health score and action.
// The card only displays + links to the existing Position Detail page.

import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ChevronRight,
  Eye,
  ShieldCheck,
  ShieldQuestion,
  WifiOff,
  Gauge,
  Crosshair,
  Activity,
} from "lucide-react";
import ActionBadge from "../analysis/ActionBadge";

// Tier visuals: color + icon + label together, so the meaning is never
// carried by color alone (accessibility).
const TIERS = {
  "HIGH ATTENTION": {
    icon: AlertTriangle,
    badge: "bg-loss/10 text-loss",
    bar: "#f28b82",
    edge: "sm:border-l-2 sm:border-l-loss",
    label: "High attention",
  },
  WATCH: {
    icon: Eye,
    badge: "bg-caution/10 text-caution",
    bar: "#fdd663",
    edge: "sm:border-l-2 sm:border-l-caution",
    label: "Watch",
  },
  HEALTHY: {
    icon: ShieldCheck,
    badge: "bg-gain/10 text-gain",
    bar: "#81c995",
    edge: "sm:border-l-2 sm:border-l-gain",
    label: "Healthy",
  },
};

const NO_DATA = {
  icon: WifiOff,
  badge: "bg-surface-3 text-ink-muted",
  edge: "",
  label: "No market data",
};

// The backend marks a position stale (live quote failed, last real snapshot
// shown) with this exact phrasing in driving_factors / primary_reason.
function isStale(p) {
  return (p.driving_factors || []).some((f) =>
    f.toLowerCase().includes("last known market data")
  );
}

function fmtPrice(v) {
  if (v == null) return "—";
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function healthColor(score) {
  if (score == null) return "text-ink-faint";
  if (score >= 70) return "text-gain";
  if (score >= 40) return "text-caution";
  return "text-loss";
}

const FACTOR_ICONS = {
  stop: Crosshair,
  target: Activity,
  score: Gauge,
};

// Tiny icon per driving factor so the scan-ability is immediately obvious:
// score / stop / target / action all get a distinct glyph.
function factorIcon(factor) {
  const lower = factor.toLowerCase();
  if (lower.includes("stop")) return FACTOR_ICONS.stop;
  if (lower.includes("target")) return FACTOR_ICONS.target;
  if (lower.includes("score")) return FACTOR_ICONS.score;
  return Activity;
}

export default function NavigatorPositionCard({ position, index }) {
  const hasAnalysis = position.attention_tier != null;
  const tier = hasAnalysis ? TIERS[position.attention_tier] : NO_DATA;
  const TierIcon = tier.icon;
  const stale = hasAnalysis && isStale(position);
  const score = position.attention_score;

  return (
    <Link
      to={`/positions/${position.position_id}`}
      className={`group relative block rounded-2xl border border-border-soft bg-surface p-5 transition hover:border-accent/50 hover:bg-surface-raised/40 sm:p-6 ${tier.edge}`}
      aria-label={`Open ${position.symbol} position details`}
    >
      {/* Rank number - keeps the ordering legible even on mobile where the
          score bar is small. */}
      <span className="absolute right-4 top-4 font-mono text-[10px] font-bold uppercase tracking-wider text-ink-faint">
        #{index + 1}
      </span>

      {/* Row 1: symbol + tier badge / attention score bar */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 pr-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-display text-xl font-bold tracking-tight text-ink">
              {position.symbol}
            </h3>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${tier.badge}`}
            >
              <TierIcon size={12} />
              {tier.label}
            </span>
            {stale && (
              <span
                title="Live quote unavailable - showing the last known market data"
                className="inline-flex items-center gap-1.5 rounded-full bg-caution/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-caution"
              >
                <ShieldQuestion size={11} />
                Stale data
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {position.attention_score != null && !hasAnalysis
              ? "No live market data"
              : hasAnalysis
                ? "Priority ranking · decision support only"
                : "Waiting for live market data"}
          </p>
        </div>

        {hasAnalysis && score != null ? (
          <div className="w-full max-w-[220px] sm:w-52">
            <div className="flex items-baseline justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                Attention score
              </span>
              <span className="font-display text-lg font-bold text-ink">
                {Math.round(score)}
                <span className="text-[10px] font-medium text-ink-faint">/100</span>
              </span>
            </div>
            <div
              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised"
              role="img"
              aria-label={`Attention score ${Math.round(score)} out of 100`}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, score))}%`, background: tier.bar }}
              />
            </div>
          </div>
        ) : (
          <span className="text-xs text-ink-faint">No score available</span>
        )}
      </div>

      {/* Row 2: key numbers */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        <div className="rounded-xl border border-border-soft bg-base/40 px-3.5 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Current price
          </div>
          <div className="mt-0.5 font-mono text-sm font-semibold text-ink">
            {fmtPrice(position.current_price)}
          </div>
        </div>
        <div className="rounded-xl border border-border-soft bg-base/40 px-3.5 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Health score
          </div>
          <div className={`mt-0.5 font-mono text-sm font-bold ${healthColor(position.health_score)}`}>
            {position.health_score != null ? `${Math.round(position.health_score)}/100` : "—"}
          </div>
        </div>
        <div className="rounded-xl border border-border-soft bg-base/40 px-3.5 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Action
          </div>
          <div className="mt-0.5">
            {position.current_action ? (
              <ActionBadge action={position.current_action} />
            ) : (
              <span className="text-xs text-ink-faint">—</span>
            )}
          </div>
        </div>
      </div>

      {/* Row 3: driving factors - concise scannable chips */}
      {(position.driving_factors || []).length > 0 && (
        <div className="mt-5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Why it ranks like this
          </div>
          <ul className="mt-2 flex flex-wrap gap-2">
            {position.driving_factors.map((factor) => {
              const Icon = factorIcon(factor);
              return (
                <li
                  key={factor}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-base/40 px-2.5 py-1.5 text-xs text-ink-muted"
                >
                  <Icon size={12} className="shrink-0 text-ink-faint" />
                  {factor}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Row 4: primary reason + next thing to watch */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border-soft bg-base/40 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Primary reason
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            {position.primary_reason || "No analysis available for this position yet."}
          </p>
        </div>
        <div className="rounded-xl border border-accent/25 bg-accent/5 p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
            Next thing to watch
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-ink">
            {position.next_thing_to_watch || "—"}
          </p>
        </div>
      </div>

      {/* Footer affordance: open the full position detail */}
      <div className="mt-5 flex items-center justify-end gap-1.5 text-xs font-semibold text-ink-faint transition group-hover:text-accent">
        Open position details
        <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}