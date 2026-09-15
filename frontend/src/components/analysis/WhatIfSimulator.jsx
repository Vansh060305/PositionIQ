// Every price change is debounced before hitting the API, since a slider
// drag can fire dozens of change events per second - each real call also
// logs a what_if_runs row, so debouncing keeps that table sane too.

import { useState, useEffect, useRef } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import ScoreGauge from "./ScoreGauge";
import ActionBadge from "./ActionBadge";
import { simulatePrice } from "../../api/simulator";

export default function WhatIfSimulator({ positionId, basePrice }) {
  const [price, setPrice] = useState(basePrice);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const min = Math.max(0.01, basePrice * 0.5);
  const max = basePrice * 1.5;

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await simulatePrice(positionId, price);
        setResult(data);
      } catch {
        // exploratory feature - a failed simulate shouldn't show a scary error
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [price]);

  return (
    <div className="card p-6 sm:p-7">
      <div className="mb-5 flex items-center gap-2">
        <FlaskConical size={17} className="text-accent" />
        <h3 className="font-display text-base font-bold text-ink">What-if simulator</h3>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-faint">Simulated price</span>
          <span className="font-display text-lg font-bold text-ink">${price.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={0.5}
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value))}
          className="slider"
        />
      </div>

      {loading && !result ? (
        <div className="flex items-center gap-2 text-sm text-ink-faint">
          <Loader2 size={14} className="animate-spin" />
          Calculating…
        </div>
      ) : (
        result && (
          <div className="grid gap-6 sm:grid-cols-[auto,1fr]">
            <ScoreGauge score={result.health_score} />
            <div>
              <ActionBadge action={result.predicted_action} size="lg" />
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div>
                  <div className="font-display text-sm font-bold text-ink">
                    {result.pnl_percent > 0 ? "+" : ""}
                    {result.pnl_percent}%
                  </div>
                  <div className="text-[11px] text-ink-faint">P&L</div>
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-ink">
                    {result.distance_to_stop != null ? `${result.distance_to_stop}%` : "—"}
                  </div>
                  <div className="text-[11px] text-ink-faint">Stop buffer</div>
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-ink">
                    {result.distance_to_target != null ? `${result.distance_to_target}%` : "—"}
                  </div>
                  <div className="text-[11px] text-ink-faint">To target</div>
                </div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}