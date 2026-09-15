import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Loader2, Eye, EyeOff } from "lucide-react";

import AuthLayout from "../components/auth/AuthLayout";
import { loginUser, getCurrentUser } from "../api/auth";
import useAuthStore from "../store/authStore";

export default function Login() {
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
      const { access_token } = await loginUser(email, password);
      setToken(access_token);
      const user = await getCurrentUser();
      setUser(user);
      navigate("/dashboard");
    } catch (err) {
      // Backend sends a clear "detail" message for wrong credentials etc.
      setError(err.response?.data?.detail || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to check on your positions."
      sparkle
      footer={
        <>
          New here?{" "}
          <Link to="/register" className="text-accent transition hover:text-accent-bright">
            Create an account
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pr-11"
              placeholder="••••••••"
              autoComplete="current-password"
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
              Signing you in…
            </>
          ) : (
            "Sign in →"
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
