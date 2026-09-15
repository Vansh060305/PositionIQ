import api from "./client";

export async function listPositions(statusFilter) {
  const { data } = await api.get("/positions", {
    params: statusFilter ? { status: statusFilter } : {},
  });
  return data;
}

export async function getPosition(id) {
  const { data } = await api.get(`/positions/${id}`);
  return data;
}

export async function createPosition(payload) {
  const { data } = await api.post("/positions", payload);
  return data;
}

export async function updatePosition(id, payload) {
  // PATCH accepts stop_loss, target, quantity, status - whatever the user sends
  const { data } = await api.patch(`/positions/${id}`, payload);
  return data;
}

export async function deletePosition(id) {
  const { data } = await api.delete(`/positions/${id}`);
  return data;
}

export async function closePosition(id, exitPrice) {
  const { data } = await api.post(`/positions/${id}/close`, { exit_price: exitPrice });
  return data;
}
