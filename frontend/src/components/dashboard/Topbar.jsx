// In-app top bar in the NiveshMitra style: gradient brand mark + text, a
// thin gradient underline, and pill actions. All existing logic unchanged.

import { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { LogOut, Sparkles } from "lucide-react";
import BrandMark from "../BrandMark";
import useAuthStore from "../../store/authStore";
import useSubscriptionStore from "../../store/subscriptionStore";
import useAssistantStore from "../../store/assistantStore";
import { getSubscriptionStatus } from "../../api/payments";
import AlertsBell from "./AlertsBell";
import UpgradeButton from "./UpgradeButton";
import AIAssistantDrawer from "../assistant/AIAssistantDrawer";

const NAV_LINKS = [
  { to: "/dashboard", label: "Positions" },
  { to: "/navigator", label: "Navigator" },
  { to: "/pulse", label: "Pulse" },
  { to: "/portfolio", label: "Portfolio" },
  { to: "/history", label: "History" },
];

export default function Topbar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const plan = useSubscriptionStore((s) => s.plan);
  const setSubscription = useSubscriptionStore((s) => s.setSubscription);
  const assistantMode = useAssistantStore((s) => s.mode);
  const toggleAssistant = useAssistantStore((s) => s.toggle);

  useEffect(() => {
    getSubscriptionStatus()
      .then((s) => setSubscription(s.plan, s.expires_at))
      .catch(() => {});
  }, [setSubscription]);

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-base/75 backdrop-blur-xl">
      <div className="relative mx-auto flex max-w-6xl flex-nowrap items-center justify-between gap-x-5 px-5 py-3">
        {/* thin gradient underline */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-brand-gradient opacity-30"
        />

        {/* LEFT: logo + nav */}
        <div className="flex items-center gap-6 min-w-0">
          <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0">
            <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border-soft bg-surface shadow-[0_0_16px_rgba(138,180,248,0.25)]">
              <BrandMark size={18} />
            </span>
            <span className="font-display text-[17px] font-bold tracking-tight text-brand">
              PositionIQ
            </span>
          </Link>

          <nav className="hidden items-center gap-6 sm:flex">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `relative text-[13.5px] font-medium transition after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:rounded-full after:bg-btn-gradient after:transition-all after:duration-200 ${
                    isActive
                      ? "text-ink after:w-full"
                      : "text-ink-muted after:w-0 hover:text-ink hover:after:w-full"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Mobile: the page links get their own row under the top bar so
            Portfolio/History stay reachable on phones (< sm). Desktop keeps
            the single-row layout above. */}
        <nav className="order-last mt-2 flex w-full items-center gap-5 border-t border-border-soft/60 pt-2 sm:hidden">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `text-[13px] font-medium transition ${
                  isActive
                    ? "bg-btn-gradient bg-clip-text text-transparent"
                    : "text-ink-muted hover:text-ink"
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* RIGHT: compact controls, one row, no wrapping */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* AI Assistant - persistent product action, opens the right-side
              drawer without navigating away. Full label on large screens. */}
          <button
            onClick={toggleAssistant}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              assistantMode !== "closed"
                ? "border-accent/60 bg-accent/10 text-accent"
                : "border-border bg-surface text-ink hover:border-accent/50 hover:text-accent"
            }`}
            aria-label="AI Assistant"
            aria-expanded={assistantMode !== "closed"}
            aria-haspopup="dialog"
            title="AI Assistant"
          >
            <Sparkles size={13} className="text-accent" />
            <span className="hidden lg:inline">AI Assistant</span>
          </button>
          {user && (
            <span className="hidden max-w-[160px] truncate text-[13px] text-ink-faint lg:inline">
              {user.email}
            </span>
          )}
          {plan === "PRO" ? (
            <span
              title="PRO Demo - no payment involved"
              className="rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-accent"
            >
              PRO Demo
            </span>
          ) : (
            <UpgradeButton />
          )}
          <AlertsBell />
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-full border border-border/60 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-faint transition hover:border-loss/50 hover:text-loss"
          >
            <LogOut size={13} />
            <span className="hidden xs:inline">Log out</span>
          </button>
        </div>
      </div>

      {/* AI Assistant - fixed right-side overlay, mounted here so it is
          available on every authenticated page without a separate route. */}
      <AIAssistantDrawer />
    </header>
  );
}