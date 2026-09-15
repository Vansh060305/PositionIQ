import { create } from "zustand";

const useSubscriptionStore = create((set) => ({
  plan: "FREE",
  expiresAt: null,
  setSubscription: (plan, expiresAt) => set({ plan, expiresAt }),
}));

export default useSubscriptionStore;
