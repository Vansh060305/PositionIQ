import api from "./client";

export async function registerUser(email, password) {
  const { data } = await api.post("/auth/register", { email, password });
  return data;
}

export async function loginUser(email, password) {
  // FastAPI's OAuth2PasswordRequestForm expects form-encoded data, not JSON
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return data; // { access_token, token_type }
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data;
}
