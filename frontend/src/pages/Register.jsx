import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import { registerUser, loginUser, getCurrentUser } from "../api/auth";
import useAuthStore from "../store/authStore";

// FastAPI/Pydantic returns 422 validation errors as a detail ARRAY (e.g.
// an invalid email). Turn that into one clear, human-readable line instead
// of letting an object leak into the UI.
function friendlyError(detail) {
  if (Array.isArray(detail) && detail.length > 0) {
    const field = detail[0]?.loc?.join(".") || "";
    if (field.includes("email")) return "Please enter a valid email address.";
    if (field.includes("password")) return "Password must be at least 8 characters.";
    return "Please check the form and try again.";
  }
  return typeof detail === "string" && detail.length > 0
    ? detail
    : "Something went wrong. Try again.";
}

export default function Register() {
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // Accounts are created ready to use - no email verification step, so
      // log the new user straight in and land on the dashboard.
      await registerUser(email.trim(), password);
      const { access_token } = await loginUser(email.trim(), password);
      setToken(access_token);
      const user = await getCurrentUser();
      setUser(user);
      navigate("/dashboard");
    } catch (err) {
      setError(friendlyError(err.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Start your free analysis"
      subtitle="Track up to 10 positions, free forever."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-accent transition hover:text-accent-bright">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-[13px] font-semibold text-ink-muted">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1.5"
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label className="block text-[13px] font-semibold text-ink-muted">
          Password
          <span className="relative mt-1.5 block">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-11"
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-faint transition hover:text-ink-muted"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </span>
        </label>

        {error && <div className="text-[13px] text-loss">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary mt-2 w-full py-3 text-[15px]"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Creating account…
            </>
          ) : (
            "Create account →"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
