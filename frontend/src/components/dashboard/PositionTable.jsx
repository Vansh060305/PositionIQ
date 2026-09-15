// Dashboard position table - shows every open position with live market
// data (current price, P&L, P&L %, score) from the backend analysis engine
// and Finnhub. LONG/SHORT P&L signs match the backend engine exactly
// (position_engine.calculate_pnl_percent): LONG profits when price rises,
// SHORT profits when it falls.

import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import ActionBadge from "../analysis/ActionBadge";
import useLiveStore from "../../store/liveStore";

const GRID =
  "grid grid-cols-[1.3fr,0.6fr,0.7fr,0.8fr,0.9fr,0.8fr,0.7fr,0.7fr,0.6fr,1fr,auto] items-center gap-3";

function fmtMoney(v) {
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPnl(v) {
  return `${v >= 0 ? "+" : "-"}$${Math.abs(v).toFixed(2)}`;
}

function pnlClass(v) {
  if (v > 0) return "text-gain";
  if (v < 0) return "text-loss";
  return "text-ink-muted";
}

function scoreClass(score) {
  if (score >= 70) return "text-gain";
  if (score >= 40) return "text-caution";
  return "text-loss";
}

function PositionRow({ position, analysis }) {
  const liveDecision = useLiveStore((s) => s.liveDecisions[position.id]);

  const ok = analysis?.status === "ok";
  const failed = analysis?.status === "error";

  // A WebSocket payload for this position overrides the REST-loaded row so
  // the table reflects the latest tick without a manual refresh. REST stays
  // the fallback until the first live message arrives.
  const currentPrice = liveDecision?.current_price ?? (ok ? analysis.currentPrice : null);
  const pnlPercent = liveDecision?.pnl_percent ?? (ok ? analysis.pnlPercent : null);
  // Dollar P&L derived from the backend's pnl_percent so the sign always
  // matches the engine's LONG/SHORT convention: pnl% / 100 x cost basis.
  const dollarPnl =
    pnlPercent != null ? (pnlPercent / 100) * position.entry_price * position.quantity : null;
  const action = liveDecision?.action ?? (ok ? analysis.action : null);
  const score = liveDecision?.health_score ?? (ok ? analysis.score : null);
  const liveUpdatedAt = liveDecision?.timestamp
    ? new Date(liveDecision.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : null;

  return (
    <Link
      to={`/positions/${position.id}`}
      className={`${GRID} border-b border-border-soft px-5 py-4 text-sm transition last:border-b-0 hover:bg-surface-raised/60`}
    >
      <div>
        <div className="font-display font-bold text-ink">{position.symbol}</div>
        <div className="text-[11px] text-ink-faint">
          {position.exchange} · {position.position_type} · {position.sector || "Unclassified"}
        </div>
      </div>
      <div className="font-medium text-ink-muted">{position.quantity}</div>
      <div className="font-medium text-ink-muted">{fmtMoney(position.entry_price)}</div>
      <div
        className="font-medium text-ink"
        title={liveUpdatedAt ? `Live update ${liveUpdatedAt}` : undefined}
      >
        {currentPrice != null ? (
          fmtMoney(currentPrice)
        ) : failed ? (
          <span className="text-[11px] text-loss">Unavailable</span>
        ) : (
          <span className="text-ink-faint">…</span>
        )}
      </div>
      <div className={`font-semibold ${pnlClass(dollarPnl)}`}>
        {dollarPnl != null
          ? fmtPnl(dollarPnl)
          : failed
            ? "—"
            : "…"}
      </div>
      <div className={`font-semibold ${pnlClass(pnlPercent)}`}>
        {pnlPercent != null
          ? `${pnlPercent >= 0 ? "+" : "-"}${Math.abs(pnlPercent).toFixed(2)}%`
          : failed
            ? "—"
            : "…"}
      </div>
      <div className="font-medium text-ink-muted">
        {position.target ? fmtMoney(position.target) : "—"}
      </div>
      <div className="font-medium text-ink-muted">
        {position.stop_loss ? fmtMoney(position.stop_loss) : "—"}
      </div>
      <div
        className={`font-bold ${score != null ? scoreClass(score) : "text-ink-faint"}`}
        title={score != null ? `Position score ${Math.round(score)}/100` : undefined}
      >
        {score != null ? Math.round(score) : failed ? "—" : "…"}
      </div>
      <div>
        {action ? (
          <ActionBadge action={action} />
        ) : ok ? (
          <span className="text-[11px] text-ink-faint">No signal</span>
        ) : failed ? (
          <span className="text-[11px] text-loss">Failed</span>
        ) : (
          <span className="text-ink-faint">…</span>
        )}
      </div>
      <ChevronRight size={16} className="text-ink-faint" />
    </Link>
  );
}

export default function PositionTable({ positions, analyses }) {
  return (
    <div className="card overflow-hidden">
      {/* Header and rows share one scroll container so the columns always
          stay aligned - a header fixed outside the scroll area would clip or
          drift out of sync with the rows once the table overflows. */}
      <div className="overflow-x-auto">
        <div className="w-full min-w-[1080px]">
          <div
            className={`${GRID} border-b border-border-soft bg-base/40 px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-ink-faint`}
          >
            <div>Symbol</div>
            <div>Qty</div>
            <div>Entry</div>
            <div>Current</div>
            <div>P&amp;L</div>
            <div>P&amp;L %</div>
            <div>Target</div>
            <div>Stop</div>
            <div>Score</div>
            <div>Signal</div>
            <div />
          </div>
          {positions.map((p) => (
            <PositionRow key={p.id} position={p} analysis={analyses[p.id]} />
          ))}
        </div>
      </div>
    </div>
  );
}