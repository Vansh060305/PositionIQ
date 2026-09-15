// A focused modal for closing a position - captures the exit price,
// shows the resulting realized P&L immediately after confirming.
//
// The exit price is pre-filled with the latest LIVE market price for the
// symbol (fetched fresh on open, with the page's current quote as an
// instant fallback) - never the entry price, so a blind "Confirm close"
// realizes the position at market instead of locking in $0 P&L. If no
// live price can be retrieved the field stays empty and the user must
// type an exit price rather than being silently handed a wrong one.

import { useEffect, useRef, useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { closePosition } from "../../api/positions";
import { getQuote } from "../../api/market";

export default function ClosePositionModal({ position, livePrice, onClose, onClosed }) {
  // livePrice is the real current market price already known on the page
  // (latest analysis snapshot). Prefill instantly with it when available.
  const [exitPrice, setExitPrice] = useState(
    livePrice != null && !Number.isNaN(Number(livePrice)) ? String(livePrice) : ""
  );
  const [priceState, setPriceState] = useState(
    livePrice != null ? "live" : "fetching"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Becomes true only once the user actually types, so the fresh-quote
  // fetch may prefill the field but never clobber a manual edit.
  const userEdited = useRef(false);

  // Refresh the prefill with the freshest quote for the symbol. Manual
  // edits are never overwritten.
  useEffect(() => {
    let active = true;
    getQuote(position.symbol)
      .then((q) => {
        if (!active || userEdited.current) return;
        const price = q?.current_price;
        if (price != null && !Number.isNaN(Number(price))) {
          setExitPrice(String(price));
          setPriceState("live");
        } else {
          setPriceState("unavailable");
        }
      })
      .catch(() => {
        if (active && !userEdited.current) setPriceState("unavailable");
      });
    return () => {
      active = false;
    };
  }, [position.symbol]);

  function handleChange(e) {
    userEdited.current = true;
    setExitPrice(e.target.value);
    setPriceState("manual");
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const updated = await closePosition(position.id, parseFloat(exitPrice));
      onClosed(updated);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't close this position. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const showLiveNote = priceState === "live" && exitPrice !== "";
  const showUnavailableNote = priceState === "unavailable" && exitPrice === "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-[20px] border border-border-soft bg-surface p-7 shadow-card-lg">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">
            Close {position.symbol}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full border border-border-soft bg-surface-raised p-2 text-ink-faint transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleConfirm}>
          <label className="mb-1.5 block text-xs font-medium text-ink-muted">
            Exit price
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={exitPrice}
            onChange={handleChange}
            placeholder={priceState === "fetching" ? "Loading live price…" : "0.00"}
            className="input"
          />
          <p className="mt-2.5 text-xs text-ink-faint">
            {showLiveNote && (
              <span className="text-gain">Filled with the latest live market price · </span>
            )}
            Entry was ${position.entry_price} · {position.quantity} shares
          </p>
          {showUnavailableNote && (
            <p className="mt-2 text-xs text-loss/80">
              Live price unavailable right now — enter your exit price manually.
            </p>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-loss/10 px-4 py-2.5 text-sm text-loss">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-6 flex w-full py-3 text-sm"
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            Confirm close
          </button>
        </form>
      </div>
    </div>
  );
}
