// Every API call in the app goes through this instance, never raw axios -
// that way the base URL, token attachment and auth-failure handling only
// need to be set up once.

import axios from "axios";
import useAuthStore from "../store/authStore";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// If the backend says 401 on a protected call, the stored token is missing,
// expired or invalid - clear the session and send the user back to Login
// instead of leaving pages stuck in broken loading/empty states.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";
    const isAuthEndpoint = url.startsWith("/auth/");
    if (status === 401 && !isAuthEndpoint) {
      useAuthStore.getState().logout(); // clears token from store + localStorage
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default api;
