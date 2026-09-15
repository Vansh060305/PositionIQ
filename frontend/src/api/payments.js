import api from "./client";

export async function getSubscriptionStatus() {
  const { data } = await api.get("/payments/subscription");
  return data;
}

export async function activateProDemo() {
  const { data } = await api.post("/payments/activate-pro-demo");
  return data;
}