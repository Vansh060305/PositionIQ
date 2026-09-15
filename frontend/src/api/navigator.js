import api from "./client";

export async function getNavigatorOverview() {
  const { data } = await api.get("/navigator/overview");
  return data;
}