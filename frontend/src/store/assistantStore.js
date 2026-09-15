// In-memory state for the AI Assistant drawer (no persistence, no DB - the
// conversation survives compact <-> expanded and close/reopen within the
// session because this store lives for the lifetime of the app).
//
// The store never fabricates answers: every assistant message comes from the
// backend's POST /assistant/ask response, rendered verbatim (including the
// backend's redirect when relevant === false).

import { create } from "zustand";
import { askAssistant } from "../api/assistant";

let messageId = 0;
const nextId = () => `msg-${++messageId}`;

const useAssistantStore = create((set, get) => ({
  // closed | compact | expanded
  mode: "closed",
  // Remembered size so reopening restores the drawer the user last used.
  lastMode: "compact",
  messages: [], // { id, role: 'user'|'assistant', content, sources?, relevant? }
  submitting: false,
  error: "",

  open() {
    set((s) => ({ mode: s.lastMode || "compact", error: "" }));
  },
  close() {
    set((s) => ({ mode: "closed", lastMode: s.mode === "closed" ? s.lastMode : s.mode, error: "" }));
  },
  setMode(mode) {
    set({ mode, lastMode: mode, error: "" });
  },
  toggle() {
    const { mode } = get();
    if (mode === "closed") {
      get().open();
    } else {
      get().close();
    }
  },
  clearConversation() {
    set({ messages: [], error: "" });
  },

  async send(question) {
    const text = question.trim();
    if (!text || get().submitting) return;

    const userMessage = { id: nextId(), role: "user", content: text };
    set((s) => ({ messages: [...s.messages, userMessage], submitting: true, error: "" }));

    try {
      const result = await askAssistant(text);
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: nextId(),
            role: "assistant",
            content: result.answer,
            relevant: result.relevant,
            sources: result.sources || [],
          },
        ],
        submitting: false,
      }));
    } catch (err) {
      // Show the safe backend message when present (e.g. Gemini unavailable);
      // never raw stack traces, keys, or Gemini internals.
      const detail = err.response?.data?.detail;
      const message =
        typeof detail === "string" && detail
          ? detail
          : "Couldn't reach the AI Assistant. Please try again.";
      set({ submitting: false, error: message });
    }
  },
}));

export default useAssistantStore;