// PRO Demo activation - one click, no payment. The backend writes a real,
// permanent PRO subscription row, so the plan persists across refresh,
// logout/login and new sessions exactly like the old paid flow.

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { activateProDemo, getSubscriptionStatus } from "../../api/payments";
import useSubscriptionStore from "../../store/subscriptionStore";

export default function UpgradeButton({ className = "" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setSubscription = useSubscriptionStore((s) => s.setSubscription);

  async function handleActivate() {
    setLoading(true);
    setError("");
    try {
      await activateProDemo();
      const status = await getSubscriptionStatus();
      setSubscription(status.plan, status.expires_at);
    } catch (err) {
      const detail = err.response?.data?.detail || "Couldn't activate PRO Demo. Try again.";
      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleActivate}
        disabled={loading}
        title="Activate the PRO Demo - no payment involved"
        className={`btn-primary px-4 py-2 text-sm ${className}`}
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        Activate PRO Demo
      </button>
      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-border-soft bg-surface px-3 py-2 text-xs leading-relaxed text-loss shadow-card-lg"
        >
          {error}
        </div>
      )}
    </div>
  );
}