// Every action type maps to one of the app's semantic health colors -
// EXIT is always critical-red, BOOK_PROFIT is always healthy-green, etc.
// Keeping this mapping in one file means the color meaning stays consistent
// everywhere the badge is used.

import { TrendingUp, TrendingDown, ShieldAlert, Shield, AlertTriangle, Pause } from "lucide-react";

const CONFIG = {
  HOLD: { label: "Hold", icon: Pause, className: "bg-accent/10 text-accent" },
  BOOK_PROFIT: { label: "Book profit", icon: TrendingUp, className: "bg-gain/10 text-gain" },
  TIGHTEN_STOP: { label: "Tighten stop", icon: ShieldAlert, className: "bg-caution/10 text-caution" },
  REDUCE: { label: "Reduce", icon: TrendingDown, className: "bg-caution/10 text-caution" },
  HEDGE: { label: "Hedge", icon: Shield, className: "bg-caution/10 text-caution" },
  EXIT: { label: "Exit", icon: AlertTriangle, className: "bg-loss/10 text-loss" },
};

export default function ActionBadge({ action, size = "md" }) {
  const cfg = CONFIG[action] || CONFIG.HOLD;
  const Icon = cfg.icon;
  const sizeClass = size === "lg" ? "px-4 py-2 text-sm" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-mono font-medium uppercase tracking-wide ${cfg.className} ${sizeClass}`}
    >
      <Icon size={size === "lg" ? 15 : 12} />
      {cfg.label}
    </span>
  );
}
