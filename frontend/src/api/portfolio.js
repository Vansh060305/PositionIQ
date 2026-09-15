import api from "./client";

export async function getPortfolioSummary() {
  const { data } = await api.get("/portfolio/summary");
  return data;
}
