// Inline "Add a position" form - NiveshMitra styling, same fields and
// submit logic as before (POST /positions).

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { createPosition } from "../../api/positions";
import UpgradeButton from "./UpgradeButton";

export default function AddPositionForm({ onCreated, onClose }) {
  const [form, setForm] = useState({
    symbol: "",
    exchange: "NASDAQ",
    sector: "",
    entry_price: "",
    quantity: "",
    stop_loss: "",
    target: "",
    position_type: "LONG",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        symbol: form.symbol.toUpperCase(),
        exchange: form.exchange,
        sector: form.sector || null,
        entry_price: parseFloat(form.entry_price),
        quantity: parseInt(form.quantity, 10),
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        target: form.target ? parseFloat(form.target) : null,
        position_type: form.position_type,
      };
      const created = await createPosition(payload);
      onCreated(created);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(Array.isArray(detail) ? detail.map((e) => e.msg || "Invalid value").join("; ") : typeof detail === "string" ? detail : "Couldn't add that position. Check the values.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="card overflow-hidden"
    >
      <form onSubmit={handleSubmit} className="p-6 sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Add a position</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-soft bg-surface-raised p-2 text-ink-faint transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Symbol</label>
            <input
              required
              value={form.symbol}
              onChange={(e) => update("symbol", e.target.value)}
              placeholder="AAPL"
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Exchange</label>
            <input
              required
              value={form.exchange}
              onChange={(e) => update("exchange", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Sector (Optional)
            </label>
            <select
              value={form.sector}
              onChange={(e) => update("sector", e.target.value)}
              className="input cursor-pointer"
            >
              <option value="">Select a sector…</option>
              <option value="Technology">Technology</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Financial Services">Financial Services</option>
              <option value="Consumer">Consumer</option>
              <option value="Energy">Energy</option>
              <option value="Industrials">Industrials</option>
              <option value="Communication Services">Communication Services</option>
              <option value="Utilities">Utilities</option>
              <option value="Real Estate">Real Estate</option>
              <option value="Materials">Materials</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Position type
            </label>
            <select
              value={form.position_type}
              onChange={(e) => update("position_type", e.target.value)}
              className="input cursor-pointer"
            >
              <option value="LONG">Long</option>
              <option value="SHORT">Short</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Entry price</label>
            <input
              required
              type="number"
              step="0.01"
              value={form.entry_price}
              onChange={(e) => update("entry_price", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">Quantity</label>
            <input
              required
              type="number"
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Stop loss (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.stop_loss}
              onChange={(e) => update("stop_loss", e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-muted">
              Target (optional)
            </label>
            <input
              type="number"
              step="0.01"
              value={form.target}
              onChange={(e) => update("target", e.target.value)}
              className="input"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-loss/10 px-4 py-3 text-sm text-loss">
            <p>{error}</p>
            {error.includes("Upgrade to PRO") && (
              <div className="mt-2">
                <UpgradeButton />
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary mt-6 px-7 py-2.5 text-sm"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          Add position
        </button>
      </form>
    </motion.div>
  );
}