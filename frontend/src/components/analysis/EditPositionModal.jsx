// Edit the PATCH-able fields of an open position (stop loss, target,
// quantity) via PUT-style update - PATCH /positions/{id}. Same modal
// language as ClosePositionModal.

import { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { updatePosition } from "../../api/positions";

export default function EditPositionModal({ position, onClose, onSaved }) {
  const [form, setForm] = useState({
    stop_loss: position.stop_loss != null ? String(position.stop_loss) : "",
    target: position.target != null ? String(position.target) : "",
    quantity: String(position.quantity),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload = {
        stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
        target: form.target ? parseFloat(form.target) : null,
        quantity: parseInt(form.quantity, 10),
      };
      const updated = await updatePosition(position.id, payload);
      onSaved(updated);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't update this position. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
      <div className="w-full max-w-sm rounded-[20px] border border-border-soft bg-surface p-7 shadow-card-lg">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">
            Edit {position.symbol}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full border border-border-soft bg-surface-raised p-2 text-ink-faint transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="space-y-4">
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
                placeholder="e.g. 180.00"
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
                placeholder="e.g. 240.00"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Quantity
              </label>
              <input
                type="number"
                required
                min="1"
                value={form.quantity}
                onChange={(e) => update("quantity", e.target.value)}
                className="input"
              />
            </div>
          </div>

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
            Save changes
          </button>
        </form>
      </div>
    </div>
  );
}