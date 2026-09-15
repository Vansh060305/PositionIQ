import api from "./client";

export async function getHealthHistory(positionId) {
  const { data } = await api.get(`/health/${positionId}/history`);
  return data;
}
