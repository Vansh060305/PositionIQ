// Populated by useWebSocket - any component can read from here to reflect
// real-time updates without polling the REST API on a timer.
//
// liveDecisions: { [positionId]: { action, confidence, health_score,
// current_price, pnl_percent, timestamp } } - the full backend payload, so
// live values can override the REST-loaded ones while a page is open.

import { create } from "zustand";

const useLiveStore = create((set) => ({
  liveDecisions: {}, // { [positionId]: full decision_update payload }

  setLiveDecision: (positionId, update) =>
    set((state) => ({
      liveDecisions: { ...state.liveDecisions, [positionId]: update },
    })),
}));

export default useLiveStore;
