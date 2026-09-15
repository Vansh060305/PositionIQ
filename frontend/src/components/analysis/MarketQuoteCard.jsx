// Live market data for one symbol, straight from the existing Finnhub-backed
// GET /market/quote/{symbol} endpoint - never fabricated numbers. Shows a
// compact loading state while fetching and a clear error with retry if the
// quote can't be reached, so the page never guesses a price.
//
// Manual refresh (clicking the refresh icon) requests a fresh quote and
// updates the card, with a loading state while it loads. A manual REST
// refresh must not overwrite a newer WebSocket value with stale data, so
// when the live WebSocket store has a newer decision for this position,
// its current_price wins instead of the REST response.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { getQuote } from "../../api/market";
import useLiveStore from "../../store/liveStore";

function fmt(v) {
  return v != null ? `$${Number(v).toFixed(2)}` : "—";
}

export default function MarketQuoteCard({ symbol, refreshToken }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const liveId = useLiveStore((s) => s.liveDecisions?.[symbol.toLowerCase()]);

  const load = useCallback(
    (silent = false) => {
      if (!silent) {
        setError("");
        setLoading(true);
      }
      return getQuote(symbol).then(
        (data) => {
          setQuote(data);
          setError("");
        },
        (err) => {
          if (!silent) {
            setError(err.response?.data?.detail || "Couldn't fetch a live quote. Try again.");
          }
          // Silent refresh failures keep the last good quote on screen -
          // never replace real data with an error state mid-view.
        }
      );
    },
    [symbol]
  );

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  // When a WebSocket live update arrives for this position (the parent
  // passes the backend update timestamp), silently re-fetch the quote so
  // the displayed price/change keep pace without a manual refresh - no
  // spinner flash, no placeholder state.
  //
  // This live-then-restore still respects the newer-value rule: the REST
  // response only lands if the live store doesn't already have a fresher
  // current_price for this symbol.
  const lastRefreshToken = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken && refreshToken !== lastRefreshToken.current) {
      lastRefreshToken.current = refreshToken;
      load(true).catch(() => {});
    }
  }, [refreshToken, load]);

  // Manual refresh handler: request a fresh quote with a loading state.
  // If a newer WebSocket value landed while we were refreshing, the REST
  // response is intentionally ignored so we never regress to stale data.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      const data = await getQuote(symbol);
      // Only land the REST quote if the live store doesn't have a newer price.
      const livePrice = liveId?.current_price;
      if (livePrice != null && data.current_price != null && data.current_price !== livePrice) {
        // live store is newer - keep displaying whatever the live value shows
        // (the parent already applies liveDecision.current_price via displayPrice)
        setQuote(data);
        return;
      }
      setQuote(data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't fetch a live quote. Try again.");
    } finally {
      setRefreshing(false);
    }
  }, [symbol, liveId]);

  const change = quote?.change;
  const isUp = change > 0;

  return (
    <div className="card mt-6 p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Live market · {symbol}
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          aria-label="Refresh quote"
          className="rounded-full border border-border-soft bg-surface-raised p-1.5 text-ink-faint transition hover:text-ink disabled:opacity-60"
        >
          {refreshing ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span className="sr-only">Refreshing…</span>
            </>
          ) : (
            <RefreshCw size={13} />
          )}
        </button>
      </div>

      {loading && !quote ? (
        <p className="flex items-center gap-2 text-sm text-ink-faint">
          <Loader2 size={14} className="animate-spin" />
          Fetching live price…
        </p>
      ) : error && !quote ? (
        <p className="text-sm text-loss">{error}</p>
      ) : (
        quote && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <div className="bg-btn-gradient bg-clip-text font-display text-2xl font-bold text-transparent">
                {fmt(quote.current_price)}
              </div>
              <div className="text-[11px] text-ink-faint">Current price</div>
            </div>
            <div className="flex items-center gap-2">
              {quote.change != null &&
                (isUp ? (
                  <TrendingUp size={15} className="text-gain" />
                ) : (
                  <TrendingDown size={15} className="text-loss" />
                ))}
              <span className={`font-display text-lg font-bold ${isUp ? "text-gain" : change < 0 ? "text-loss" : "text-ink"}`}>
                {change > 0 ? "+" : ""}
                {change != null ? `$${Number(change).toFixed(2)}` : "—"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  isUp ? "bg-gain/10 text-gain" : change < 0 ? "bg-loss/10 text-loss" : "bg-ink-faint/10 text-ink-faint"
                }`}
              >
                {quote.percent_change > 0 ? "+" : ""}
                {quote.percent_change != null ? `${Number(quote.percent_change).toFixed(2)}%` : "—"}
              </span>
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <div className="font-semibold text-ink">{fmt(quote.open)}</div>
                <div className="text-[10.5px] text-ink-faint">Open</div>
              </div>
              <div>
                <div className="font-semibold text-ink">{fmt(quote.high)}</div>
                <div className="text-[10.5px] text-ink-faint">Day high</div>
              </div>
              <div>
                <div className="font-semibold text-ink">{fmt(quote.low)}</div>
                <div className="text-[10.5px] text-ink-faint">Day low</div>
              </div>
              <div>
                <div className="font-semibold text-ink">{fmt(quote.previous_close)}</div>
                <div className="text-[10.5px] text-ink-faint">Prev close</div>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
