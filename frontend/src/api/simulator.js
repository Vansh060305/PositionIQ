import api from "./client";

export async function simulatePrice(positionId, simulatedPrice) {
  const { data } = await api.post(`/simulator/${positionId}`, { simulated_price: simulatedPrice });
  return data;
}
