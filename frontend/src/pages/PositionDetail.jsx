import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ScanLine, Radio, Sparkles, XCircle, Pencil, Trash2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

import Topbar from "../components/dashboard/Topbar";
import ScoreGauge from "../components/analysis/ScoreGauge";
import AIText from "../components/analysis/AIText";
import ActionBadge from "../components/analysis/ActionBadge";
import AIInsightsPanel from "../components/analysis/AIInsightsPanel";
import WhatIfSimulator from "../components/analysis/WhatIfSimulator";
import ClosePositionModal from "../components/analysis/ClosePositionModal";
import EditPositionModal from "../components/analysis/EditPositionModal";
import MarketQuoteCard from "../components/analysis/MarketQuoteCard";
import { getPosition, deletePosition } from "../api/positions";
import { getHealthHistory } from "../api/health";
import { generateDecision, getLatestDecision, explainDecision } from "../api/decisions";
import useLiveStore from "../store/liveStore";

export default function PositionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const liveDecision = useLiveStore((s) => s.liveDecisions[id]);

  const [position, setPosition] = useState(null);
  const [decision, setDecision] = useState(null);
  const [history, setHistory] = useState([]);
  const [explaining, setExplaining] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");

  const loadAll = useCallback(async () => {
    try {
      const [pos, hist] = await Promise.all([getPosition(id), getHealthHistory(id)]);
      setPosition(pos);
      setHistory(hist);
      setLoadError("");
      try {
        const dec = await getLatestDecision(id);
        setDecision(dec);
      } catch {
        // 404 just means no analysis has been run yet - not a real error
        setDecision(null);
      }
    } catch (err) {
      // Distinguish "this position is gone" from "the API/backend failed"
      // so the page never sits on a permanent Loading… spinner
      if (err.response?.status === 404) {
        setLoadError("This position no longer exists. It may have been deleted.");
      } else {
        setLoadError(err.response?.data?.detail || "Couldn't load this position. Try again.");
      }
    }
  }, [id]);

  function retryLoad() {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  // A "live update received" marker is shown only for a payload that
  // arrived AFTER this page mounted - a decision pushed while we were on
  // another page (and merely carried over in the shared store) is not a
  // live update on this screen.
  const seenLiveTimestamp = useRef(liveDecision?.timestamp || null);
  const [liveReceivedAt, setLiveReceivedAt] = useState(null);

  // When the background broadcaster pushes a fresh decision for this exact
  // position, the visible numbers update straight from the WebSocket
  // payload (rendered below) while this background sync refreshes the
  // score-history chart and keeps the decision/explanation state in step.
  useEffect(() => {
    const ts = liveDecision?.timestamp;
    if (!ts || ts === seenLiveTimestamp.current) return;
    seenLiveTimestamp.current = ts;
    setLiveReceivedAt(ts);
    loadAll();
  }, [liveDecision, loadAll]);

  async function handleRunAnalysis() {
    setRunning(true);
    setError("");
    try {
      const dec = await generateDecision(id);
      setDecision(dec);
      const hist = await getHealthHistory(id); // refresh so the chart includes the new point
      setHistory(hist);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't run analysis. Try again.");
    } finally {
      setRunning(false);
    }
  }

  async function handleExplain() {
    setExplaining(true);
    setError("");
    try {
      const dec = await explainDecision(id);
      setDecision(dec);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't get an explanation. Try again.");
    } finally {
      setExplaining(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${position?.symbol || "this position"}? This can't be undone.`)) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await deletePosition(id);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't delete this position. Try again.");
      setDeleting(false);
    }
  }

  if (!position) {
    if (loading) {
      return (
        <div className="min-h-screen">
          <Topbar />
          <div className="mx-auto max-w-4xl px-6 py-20 text-center text-ink-faint">Loading…</div>
        </div>
      );
    }
    return (
      <div className="min-h-screen">
        <Topbar />
        <main className="mx-auto max-w-4xl px-6 py-10">
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <p className="max-w-xs text-sm text-loss">{loadError || "Couldn't load this position."}</p>
            <button onClick={retryLoad} className="btn-primary mt-6 px-6 py-2.5 text-sm">
              Try again
            </button>
          </div>
        </main>
      </div>
    );
  }

  // history comes back newest-first from the API, so [0] is the latest snapshot
  const latestSnapshot = history[0];
  const isOpen = position.status === "OPEN";

  // Live WebSocket values win over the REST snapshot while a fresh payload
  // exists, so Current Price / P&L / score move the moment a tick arrives
  // instead of waiting for (or being overwritten by) a REST refetch.
  const displayScore = liveDecision?.health_score ?? latestSnapshot?.health_score;
  const displayPrice = liveDecision?.current_price ?? latestSnapshot?.current_price;
  const displayPnlPct = liveDecision?.pnl_percent ?? latestSnapshot?.pnl_percent;
  const chartData = [...history]
    .reverse()
    .map((h) => ({
      time: new Date(h.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      score: h.health_score,
    }));
  // Historical score chart - shown for open positions and in the closed
  // view (it is history, not a live signal).
  const scoreHistoryChart =
    chartData.length > 1 && (
      <div className="border-t border-border-soft p-6">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Score history
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <XAxis dataKey="time" stroke="#6b6f76" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} stroke="#6b6f76" fontSize={11} tickLine={false} axisLine={false} width={28} />
            <Tooltip
              contentStyle={{
                background: "#282a2c",
                border: "1px solid #444746",
                borderRadius: 10,
                fontSize: 12,
                color: "#e3e3e3",
              }}
            />
            <Line type="monotone" dataKey="score" stroke="#8ab4f8" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/dashboard"
          className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to positions
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{position.symbol}</h1>
            <p className="mt-1 text-sm text-ink-muted">
              {position.exchange} · {position.position_type} · Entry ${position.entry_price} · Qty{" "}
              {position.quantity}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {position.status === "OPEN" && (
              <button
                onClick={() => setShowEditModal(true)}
                className="btn-ghost px-5 py-2.5 text-sm"
              >
                <Pencil size={15} />
                Edit position
              </button>
            )}
            {position.status === "OPEN" && (
              <button
                onClick={() => setShowCloseModal(true)}
                className="btn-ghost px-5 py-2.5 text-sm text-ink-muted transition hover:border-loss/50 hover:text-loss"
              >
                <XCircle size={15} />
                Close position
              </button>
            )}
            {position.status === "OPEN" && (
              <button
                onClick={handleRunAnalysis}
                disabled={running}
                className="btn-primary px-6 py-2.5 text-sm"
              >
                {running ? <Loader2 size={15} className="animate-spin" /> : <ScanLine size={15} />}
                Run analysis
              </button>
            )}
          </div>
        </div>

        {!isOpen && (
          <div className="card mt-5 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft px-6 py-4">
              <span className="rounded-full bg-ink-faint/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                {position.status}
              </span>
              {position.closed_at && (
                <span className="text-xs text-ink-muted">
                  Closed{" "}
                  {new Date(position.closed_at).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 px-6 py-5 sm:grid-cols-3">
              {(() => {
                const costBasis = position.entry_price * position.quantity;
                const realized = position.realized_pnl;
                const returnPct = realized != null ? (realized / costBasis) * 100 : null;
                const tiles = [
                  { label: "Entry price", value: `$${position.entry_price.toFixed(2)}` },
                  {
                    label: "Exit price",
                    value: position.exit_price != null ? `$${position.exit_price.toFixed(2)}` : "—",
                  },
                  { label: "Quantity", value: String(position.quantity) },
                  {
                    label: "Realized P&L",
                    value:
                      realized != null
                        ? `${realized >= 0 ? "+" : ""}$${Math.abs(realized).toFixed(2)}`
                        : "—",
                    tone: realized != null ? (realized > 0 ? "text-gain" : realized < 0 ? "text-loss" : "text-ink") : null,
                  },
                  {
                    label: "Return",
                    value:
                      returnPct != null ? `${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(2)}%` : "—",
                    tone: returnPct != null ? (returnPct > 0 ? "text-gain" : returnPct < 0 ? "text-loss" : "text-ink") : null,
                  },
                  {
                    label: "Position type",
                    value: position.position_type === "SHORT" ? "Short" : "Long",
                  },
                ];
                return tiles.map((t) => (
                  <div key={t.label}>
                    <div className={`font-display text-sm font-bold ${t.tone || "text-ink"}`}>
                      {t.value}
                    </div>
                    <div className="text-[11px] text-ink-faint">{t.label}</div>
                  </div>
                ));
              })()}
            </div>
            {scoreHistoryChart}
          </div>
        )}

        {showCloseModal && (
          <ClosePositionModal
            position={position}
            livePrice={latestSnapshot?.current_price ?? null}
            onClose={() => setShowCloseModal(false)}
            onClosed={(updated) => {
              setPosition(updated);
              setShowCloseModal(false);
            }}
          />
        )}

        {showEditModal && (
          <EditPositionModal
            position={position}
            onClose={() => setShowEditModal(false)}
            onSaved={(updated) => {
              setPosition(updated);
              setShowEditModal(false);
            }}
          />
        )}

        {isOpen && liveReceivedAt && (
          <div
            className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent"
            title={`Backend update at ${new Date(liveReceivedAt).toLocaleString()}`}
          >
            <Radio size={12} className="animate-pulse" />
            Live update received ·{" "}
            {new Date(liveReceivedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-loss/10 px-4 py-2.5 text-sm text-loss">{error}</p>
        )}

        {isOpen && <MarketQuoteCard symbol={position.symbol} refreshToken={liveReceivedAt} />}

        {isOpen && (!decision || !latestSnapshot ? (
          <div className="mt-10 flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-16 text-center">
            <ScanLine size={26} className="text-ink-faint" />
            <h3 className="mt-4 font-display text-lg font-bold text-ink">No analysis yet</h3>
            <p className="mt-1 max-w-xs text-sm text-ink-muted">
              Run an analysis to get a score and a recommended action for this position.
            </p>
          </div>
        ) : (
          <div className="card mt-10 overflow-hidden">
            <div className="grid gap-8 p-8 sm:grid-cols-[auto,1fr]">
              <ScoreGauge score={displayScore} />

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <ActionBadge action={liveDecision?.action ?? decision.action} size="lg" />
                  <span className="text-xs text-ink-faint">
                    {Math.round((liveDecision?.confidence ?? decision.confidence) * 100)}% confidence
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
                  {(() => {
                    // Dollar P&L mirrors the backend engine's LONG/SHORT sign
                    const dollarPnl =
                      (displayPnlPct / 100) *
                      position.entry_price *
                      position.quantity;
                    return [
                      {
                        label: `P&L · ${displayPnlPct > 0 ? "+" : ""}${displayPnlPct}%`,
                        value: `${dollarPnl >= 0 ? "+" : ""}$${Math.abs(dollarPnl).toFixed(2)}`,
                        tone: dollarPnl > 0 ? "text-gain" : dollarPnl < 0 ? "text-loss" : "text-ink",
                      },
                      {
                        label: "Target",
                        value: position.target ? `$${position.target.toFixed(2)}` : "—",
                      },
                      {
                        label: "Stop loss",
                        value: position.stop_loss ? `$${position.stop_loss.toFixed(2)}` : "—",
                      },
                      {
                        label: "Stop buffer",
                        value:
                          latestSnapshot.distance_to_stop != null
                            ? `${latestSnapshot.distance_to_stop}%`
                            : "—",
                      },
                      {
                        label: "To target",
                        value:
                          latestSnapshot.distance_to_target != null
                            ? `${latestSnapshot.distance_to_target}%`
                            : "—",
                      },
                      { label: "Volatility", value: `${latestSnapshot.volatility}%` },
                    ].map((s) => (
                      <div key={s.label}>
                        <div className={`font-display text-sm font-bold ${s.tone || "text-ink"}`}>
                          {s.value}
                        </div>
                        <div className="text-[11px] text-ink-faint">{s.label}</div>
                      </div>
                    ));
                  })()}
                </div>

                <div className="mt-6 border-t border-border-soft pt-5">
                  {decision.explanation ? (
                    <p className="text-sm leading-relaxed text-ink-muted">
                      <AIText text={decision.explanation} />
                    </p>
                  ) : (
                    <button
                      onClick={handleExplain}
                      disabled={explaining}
                      className="flex items-center gap-1.5 text-sm font-medium text-accent transition hover:text-accent-bright disabled:opacity-60"
                    >
                      {explaining ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Sparkles size={13} />
                      )}
                      Get a plain-English explanation
                    </button>
                  )}
                </div>
              </div>
            </div>

            {scoreHistoryChart}
          </div>
          ))}

        {isOpen && (
          <div className="mt-6">
            <WhatIfSimulator
              positionId={id}
              basePrice={displayPrice ?? position.entry_price}
            />
          </div>
        )}

        {isOpen && decision && (
          <div className="mt-6">
            <AIInsightsPanel positionId={id} />
          </div>
        )}

        <div className="mt-8 flex justify-end border-t border-border-soft pt-5">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 text-sm text-ink-faint transition hover:text-loss disabled:opacity-60"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete position
          </button>
        </div>
      </main>
    </div>
  );
}