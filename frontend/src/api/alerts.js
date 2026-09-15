import api from "./client";

export async function listAlerts(unreadOnly = false) {
  const { data } = await api.get("/alerts", { params: { unread_only: unreadOnly } });
  return data;
}

export async function markAlertRead(id) {
  const { data } = await api.patch(`/alerts/${id}/read`);
  return data;
}
