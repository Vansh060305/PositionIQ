// Real portfolio stats, not invented placeholders. Open positions and the
// diversification score come straight from /portfolio/summary; the live
// portfolio value and total P&L are summed from the same per-position
// backend analyses (fresh Finnhub prices through the health engine) that
// the position table shows. If no live analysis is available yet the live
// cards show "—" instead of a fake $0.

import { Layers, Wallet, TrendingUp, PieChart } from "lucide-react";

function fmtMoney(v) {
  return `$${Number(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function StatsOverview({ stats }) {
  const pnlClass =
    stats.totalPnl > 0 ? "text-gain" : stats.totalPnl < 0 ? "text-loss" : "text-ink";

  const cards = [
    {
      icon: Layers,
      label: "Open positions",
      value: String(stats.positionCount ?? "—"),
      sub: null,
      valueClass: "",
    },
    {
      icon: Wallet,
      label: "Portfolio value · live",
      value: stats.portfolioValue != null ? fmtMoney(stats.portfolioValue) : "—",
      sub: stats.portfolioValue != null ? "from live prices" : "no live data yet",
      valueClass: "",
    },
    {
      icon: TrendingUp,
      label: "Total P&L · live",
      value: stats.totalPnl != null ? `${stats.totalPnl >= 0 ? "+" : "-"}$${Math.abs(stats.totalPnl).toFixed(2)}` : "—",
      sub: stats.totalPnlPct != null ? `${stats.totalPnlPct >= 0 ? "+" : "-"}${Math.abs(stats.totalPnlPct).toFixed(2)}% of cost basis` : null,
      valueClass: pnlClass,
    },
    {
      icon: PieChart,
      label: "Diversification",
      value: stats.diversification != null ? `${stats.diversification}/100` : "—",
      sub: null,
      valueClass: "",
    },
  ];

  return (
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((s) => (
        <div key={s.label} className="card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-btn-gradient text-white shadow-btn-glow">
            <s.icon size={19} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <div className={`truncate font-display text-2xl font-bold ${s.valueClass || "bg-btn-gradient bg-clip-text text-transparent"}`}>
              {s.value}
            </div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              {s.label}
            </div>
            {s.sub && <div className="mt-0.5 text-[10.5px] text-ink-faint">{s.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}