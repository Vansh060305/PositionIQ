// NiveshMitra-style auth card: centered gradient brand, title, subtitle,
// form, footer links and a "back to home" affordance.

import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import BrandMark from "../BrandMark";

export default function AuthLayout({ title, subtitle, children, footer, sparkle = false }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-[420px]">
        <div className="rounded-[20px] border border-border-soft bg-surface p-8 shadow-card-lg sm:p-9">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2.5">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border-soft bg-surface-raised shadow-[0_0_18px_rgba(138,180,248,0.25)]">
              <BrandMark size={22} />
            </span>
            <span className="font-display text-[22px] font-bold tracking-tight text-brand">
              PositionIQ
            </span>
          </Link>

          <h1 className="flex items-center justify-center gap-2 text-center text-[22px] font-bold text-ink">
            <span>{title}</span>
            {sparkle && (
              <Sparkles size={18} strokeWidth={2.2} className="text-accent" />
            )}
          </h1>
          {subtitle && (
            <p className="mb-6 mt-1.5 text-center text-[13.5px] leading-relaxed text-ink-muted">
              {subtitle}
            </p>
          )}

          {children}

          <Link
            to="/"
            className="mt-6 block w-full text-center text-[13px] text-ink-muted transition hover:text-ink"
          >
            ← Back to home
          </Link>
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
        )}
      </div>
    </div>
  );
}