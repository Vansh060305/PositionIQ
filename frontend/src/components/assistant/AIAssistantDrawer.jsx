// AI Assistant - a persistent right-side intelligence layer, not a page.
//
// Two desktop states on the same overlay:
//   compact  -> ~400px drawer pinned to the right edge
//   expanded -> ~880px workspace (still an overlay; the page stays behind it)
// The drawer stays mounted; open/close slides it in/out, compact <-> expanded
// animates the width, and the conversation (in-memory store) survives both.
//
// Every assistant message is the backend's POST /assistant/ask response
// rendered verbatim - including relevant === false redirects. No fake answers.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles,
  X,
  Maximize2,
  Minimize2,
  Send,
  Loader2,
  MessageSquarePlus,
  ArrowDownRight,
} from "lucide-react";

import useAssistantStore from "../../store/assistantStore";
import AIText from "../analysis/AIText";

const SUGGESTIONS = [
  "Why is my AAPL showing BOOK PROFIT?",
  "Which position needs the most attention?",
  "Explain my portfolio risk.",
  "What does my Market Pulse mean?",
];

function fmtSources(sources) {
  if (!sources || sources.length === 0) return "";
  return `Based on your PositionIQ data · ${sources.slice(0, 3).join(" · ")}`;
}

export default function AIAssistantDrawer() {
  const mode = useAssistantStore((s) => s.mode);
  const messages = useAssistantStore((s) => s.messages);
  const submitting = useAssistantStore((s) => s.submitting);
  const error = useAssistantStore((s) => s.error);
  const close = useAssistantStore((s) => s.close);
  const setMode = useAssistantStore((s) => s.setMode);
  const clearConversation = useAssistantStore((s) => s.clearConversation);
  const send = useAssistantStore((s) => s.send);

  const [question, setQuestion] = useState("");
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const isOpen = mode !== "closed";
  const isExpanded = mode === "expanded";

  // Conversation area scrolls independently; page scroll is locked while the
  // assistant overlay is active so the underlying page never double-scrolls.
  useEffect(() => {
    if (!isOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Keep the latest message in view (long answers included).
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, submitting, isOpen]);

  // Esc closes the assistant.
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  function handleSend(value) {
    const text = (value ?? question).trim();
    if (!text || submitting) return;
    setQuestion("");
    textareaRef.current?.focus();
    send(text);
  }

  function handleComposerKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // The drawer must overlay the whole viewport, so it is portaled to
  // document.body - a fixed child inside the sticky Topbar would be confined
  // by the header's backdrop-blur containing block instead of the screen.
  return createPortal(
    <>
      {/* Backdrop - click closes. Fades in/out; inert when closed. */}
      <div
        aria-hidden
        onClick={close}
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer - always mounted so open/close and compact/expanded animate.
          inert while closed so the off-screen controls (expand/close/send,
          the composer, suggested questions) are not keyboard-tabbable or
          announced by screen readers. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="AI Assistant"
        inert={!isOpen}
        className={`fixed bottom-0 right-0 top-0 z-[60] flex flex-col border-l border-border-soft bg-surface shadow-[0_0_60px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } ${isExpanded ? "w-[880px]" : "w-[400px]"} max-w-[calc(100vw-24px)]`}
      >
        {/* Header */}
        <header className="flex items-center justify-between gap-3 border-b border-border-soft px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-btn-gradient text-white shadow-btn-glow">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <div className="font-display text-[15px] font-bold leading-tight text-ink">
                AI Assistant
              </div>
              <div className="truncate text-[11px] text-ink-faint">PositionIQ Intelligence</div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {messages.length > 0 && (
              <button
                onClick={clearConversation}
                title="New conversation"
                aria-label="Start a new conversation"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-raised hover:text-ink"
              >
                <MessageSquarePlus size={15} />
              </button>
            )}
            <button
              onClick={() => setMode(isExpanded ? "compact" : "expanded")}
              title={isExpanded ? "Compact drawer" : "Expand workspace"}
              aria-label={isExpanded ? "Compact the assistant drawer" : "Expand the assistant workspace"}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-raised hover:text-ink"
            >
              {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={close}
              title="Close assistant"
              aria-label="Close assistant"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition hover:bg-surface-raised hover:text-loss"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {/* Conversation area - scrolls on its own */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.length === 0 && !submitting ? (
            /* Empty state: useful, clickable starting points */
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border-soft bg-surface-raised text-accent">
                <Sparkles size={22} strokeWidth={1.8} />
              </span>
              <h2 className="mt-5 font-display text-lg font-bold text-ink">
                PositionIQ Intelligence
              </h2>
              <p className="mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-ink-muted">
                Ask about your positions, portfolio, risk, P&amp;L, market data, and
                PositionIQ insights.
              </p>
              <div className="mt-6 flex w-full max-w-[360px] flex-col gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    className="group flex items-start gap-2 rounded-xl border border-border-soft bg-base/40 px-3.5 py-2.5 text-left text-[13px] text-ink-muted transition hover:border-accent/50 hover:bg-surface-raised/60 hover:text-ink"
                  >
                    <ArrowDownRight size={13} className="mt-0.5 shrink-0 text-ink-faint transition group-hover:text-accent" />
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[88%] rounded-xl rounded-br-md bg-btn-gradient px-4 py-2.5 text-sm leading-relaxed text-white shadow-btn-glow">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-start">
                    <div className="max-w-[94%] rounded-xl rounded-bl-md border border-border-soft bg-surface-raised px-4 py-3">
                      <AIText text={message.content} className="text-[13.5px] leading-relaxed text-ink-muted" />
                      {message.sources?.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-1.5 border-t border-border-soft/70 pt-2 text-[10.5px] text-ink-faint">
                          <Sparkles size={10} className="text-accent" />
                          {fmtSources(message.sources)}
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {submitting && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-xl rounded-bl-md border border-border-soft bg-surface-raised px-4 py-2.5 text-[13px] text-ink-faint">
                    <Loader2 size={13} className="animate-spin" />
                    Analyzing PositionIQ data…
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Composer - pinned to the bottom of the drawer */}
        <footer className="border-t border-border-soft bg-surface px-4 py-3.5 sm:px-5">
          {error && (
            <p className="mb-3 rounded-xl bg-loss/10 px-3.5 py-2.5 text-[13px] text-loss">
              {error}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`;
              }}
              onKeyDown={handleComposerKey}
              placeholder="Ask about your PositionIQ data..."
              aria-label="Ask the AI Assistant about your PositionIQ data"
              rows={1}
              maxLength={2000}
              className="input max-h-[132px] min-h-[42px] flex-1 resize-none py-2.5"
            />
            <button
              type="submit"
              disabled={submitting || !question.trim()}
              aria-label="Send question"
              title="Send question"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-btn-gradient text-white shadow-btn-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </form>
        </footer>
      </aside>
    </>,
    document.body
  );
}