import api from "./client";

// React StrictMode double-invokes effects in dev, which would fire two
// concurrent POSTs per position on mount and create duplicate decision +
// health-snapshot + alert rows (generate writes each time). The in-flight
// guard makes concurrent duplicate calls for the same position share one
// request, so score history stays clean. Sequential calls (the 60s poll,
// manual "Run analysis", refresh clicks) are unaffected - each still runs.
const inflight = new Map();

export async function generateDecision(positionId) {
  const key = `generate:${positionId}`;
  if (inflight.has(key)) return inflight.get(key);
  const promise = api.post(`/decisions/${positionId}/generate`).then((r) => r.data);
  inflight.set(key, promise);
  promise.finally(() => inflight.delete(key));
  return promise;
}

export async function getLatestDecision(positionId) {
  const { data } = await api.get(`/decisions/${positionId}/latest`);
  return data;
}

export async function explainDecision(positionId) {
  const { data } = await api.post(`/decisions/${positionId}/explain`);
  return data;
}

export async function askAIAssistant(positionId, question) {
  const { data } = await api.post(`/decisions/${positionId}/ask`, { question });
  return data;
}