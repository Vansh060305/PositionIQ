// Each question sends the position's real, current context (via the
// backend) to Gemini - the answer is grounded in the actual analysis,
// not a generic chatbot response. Rendered like the reference chat:
// user = gradient bubble, AI = panel bubble.

import { useState } from "react";
import { Loader2, Send, MessageSquareText } from "lucide-react";
import { askAIAssistant } from "../../api/decisions";
import AIText from "./AIText";

export default function AIInsightsPanel({ positionId }) {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'ai', text }
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleAsk(e) {
    e.preventDefault();
    if (!question.trim()) return;

    const q = question;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const { answer } = await askAIAssistant(positionId, q);
      setMessages((m) => [...m, { role: "ai", text: answer }]);
    } catch (err) {
      setError(err.response?.data?.detail || "Couldn't reach AI Insights. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card p-6 sm:p-7">
      <div className="mb-5 flex items-center gap-2">
        <MessageSquareText size={17} className="text-accent" />
        <h3 className="font-display text-base font-bold text-ink">AI Insights</h3>
      </div>

      {messages.length > 0 && (
        <div className="mb-5 max-h-72 space-y-3 overflow-y-auto">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "rounded-br-md bg-btn-gradient text-white shadow-btn-glow"
                    : "rounded-bl-md border border-border-soft bg-surface-raised text-ink-muted"
                }`}
              >
                {m.role === "user" ? m.text : <AIText text={m.text} />}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border-soft bg-surface-raised px-4 py-2.5 text-sm text-ink-faint">
                <Loader2 size={13} className="animate-spin" />
                Thinking…
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-xl bg-loss/10 px-4 py-2.5 text-sm text-loss">{error}</p>
      )}

      <form onSubmit={handleAsk} className="flex items-end gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Why should I tighten the stop?"
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={loading}
          aria-label="Send question"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-btn-gradient text-white shadow-btn-glow transition hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(108,92,255,0.55)] disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}