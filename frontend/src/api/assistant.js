import api from "./client";

// Single source for the AI Assistant - talks ONLY to the existing backend
// endpoint. The backend owns relevance, grounding and guardrails; the
// frontend never synthesizes answers.
export async function askAssistant(question) {
  const { data } = await api.post("/assistant/ask", { question });
  return data; // { answer, relevant, sources }
}