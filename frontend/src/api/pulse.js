import api from "./client";

export async function getPulseOverview() {
  const { data } = await api.get("/pulse/overview");
  return data;
}