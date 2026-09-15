// Empty state in the NiveshMitra "empty hero" style: glowing gradient
// logo circle, title, short body, gradient pill CTA.

import { LineChart } from "lucide-react";

export default function EmptyState({ onAddClick }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-soft py-20 text-center">
      <span className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full border border-border-soft bg-surface-raised text-accent shadow-[0_0_24px_rgba(138,180,248,0.25)]">
        <LineChart size={30} strokeWidth={2} />
      </span>
      <h3 className="mt-6 font-display text-xl font-bold text-ink">No positions yet</h3>
      <p className="mt-1.5 max-w-xs text-sm text-ink-muted">
        Add your first open position to get a score and a recommended action.
      </p>
      <button
        onClick={onAddClick}
        className="btn-primary mt-7 px-6 py-2.5 text-sm"
      >
        Add a position
      </button>
    </div>
  );
}