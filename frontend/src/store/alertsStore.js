// Loaded once on login via GET /alerts, then kept fresh in real time by
// useWebSocket pushing new "alert" messages straight into this store.

import { create } from "zustand";

const useAlertsStore = create((set) => ({
  alerts: [],

  setAlerts: (alerts) => set({ alerts }),

  addLiveAlert: (alert) =>
    set((state) => ({
      alerts: [
        {
          id: `live-${Date.now()}`, // temporary id until the next real fetch replaces it
          position_id: alert.position_id,
          type: alert.alert_type,
          message: alert.message,
          is_read: false,
          created_at: new Date().toISOString(),
        },
        ...state.alerts,
      ],
    })),

  markRead: (id) =>
    set((state) => ({
      alerts: state.alerts.map((a) => (a.id === id ? { ...a, is_read: true } : a)),
    })),
}));

export default useAlertsStore;
