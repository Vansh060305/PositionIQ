// Top-level route table. Landing/Login/Register are public;
// everything else requires a logged-in user.

import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import PositionDetail from "./pages/PositionDetail";
import Portfolio from "./pages/Portfolio";
import TradeHistory from "./pages/TradeHistory";
import TradeNavigator from "./pages/TradeNavigator";
import MarketPulse from "./pages/MarketPulse";
import ProtectedRoute from "./components/ProtectedRoute";
import useWebSocket from "./hooks/useWebSocket";
import { getCurrentUser } from "./api/auth";
import useAuthStore from "./store/authStore";

export default function App() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Active app-wide once a token exists - the hook itself no-ops when logged out
  useWebSocket();

  // On a hard refresh the token survives in localStorage but the user object
  // does not (zustand is in-memory). Re-fetch /auth/me so the UI knows who is
  // logged in; if the token is stale, the 401 handler clears it and the
  // ProtectedRoute redirects to Login.
  useEffect(() => {
    if (token && !user) {
      getCurrentUser()
        .then(setUser)
        .catch(() => useAuthStore.getState().logout());
    }
  }, [token, user, setUser]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/positions/:id"
        element={
          <ProtectedRoute>
            <PositionDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/navigator"
        element={
          <ProtectedRoute>
            <TradeNavigator />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pulse"
        element={
          <ProtectedRoute>
            <MarketPulse />
          </ProtectedRoute>
        }
      />
      <Route
        path="/portfolio"
        element={
          <ProtectedRoute>
            <Portfolio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <TradeHistory />
          </ProtectedRoute>
        }
      />
      {/* No CTA or stale link may point at a dead page - anything unknown
          falls back to the landing page instead of rendering blank. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
