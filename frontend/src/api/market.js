import api from "./client";

export async function getQuote(symbol) {
  const { data } = await api.get(`/market/quote/${encodeURIComponent(symbol)}`);
  return data;
}
