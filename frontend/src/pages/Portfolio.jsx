import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

import Topbar from "../components/dashboard/Topbar";
import { getPortfolioSummary } from "../api/portfolio";

// Reuses the app's semantic + brand colors, in a sensible rotation for
// however many sectors show up - never invented one-off chart colors.
const COLORS = ["#8ab4f8", "#81c995", "#fdd663", "#f28b82", "#9aa0a6", "#aecbfa"];

export default function Portfolio() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function load() {
    setError("");
    setLoading(true);
    return getPortfolioSummary().then(
      (data) => setSummary(data),
      (err) => {
        // A failed fetch is NOT an empty portfolio - surface the real error
        setError(err.response?.data?.detail || "Couldn't load your portfolio. Try again.");
      }
    );
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <div className="mx-auto max-w-4xl px-6 py-20 text-center text-ink-faint">Loading…</div>
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="min-h-screen">
        <Topbar />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <h1 className="font-display text-2xl font-bold text-ink">Portfolio analytics</h1>
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{error}</p>
            <button onClick={load} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  const hasData = summary.sector_breakdown.length > 0;

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <h1 className="font-display text-2xl font-bold text-ink">Portfolio analytics</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {summary.position_count} open positions · ${summary.total_exposure.toLocaleString()} exposure
        </p>

        {!hasData ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="text-sm text-ink-muted">Add some positions to see your sector breakdown.</p>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-[240px,1fr]">
            <div className="card p-6 text-center">
              <div className="bg-btn-gradient bg-clip-text font-display text-4xl font-bold text-transparent">
                {summary.diversification_score}
              </div>
              <div className="mt-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
                Diversification score
              </div>
              <p className="mt-3 text-xs text-ink-muted">
                0 = concentrated in one sector, 100 = evenly spread out
              </p>
            </div>

            <div className="card p-6">
              <div className="grid gap-6 sm:grid-cols-[160px,1fr]">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={summary.sector_breakdown}
                      dataKey="percent"
                      nameKey="sector"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {summary.sector_breakdown.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "#282a2c",
                        border: "1px solid #444746",
                        borderRadius: 10,
                        fontSize: 12,
                        color: "#e3e3e3",
                      }}
                      formatter={(value) => `${value}%`}
                    />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-col justify-center gap-2.5">
                  {summary.sector_breakdown.map((s, i) => (
                    <div key={s.sector} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {s.sector}
                      </span>
                      <span className="font-semibold text-ink">{s.percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
