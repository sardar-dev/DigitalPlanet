import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import SEO from "../components/SEO";
import { SITE_NAME } from "../lib/siteConfig";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    window.location.href = "/";
  }

  async function forgotPassword() {
    if (!email) {
      setError("Type your email above first, then tap \"Forgot password\".");
      return;
    }
    setError("");
    setNotice("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined,
    });
    if (error) return setError(error.message);
    setNotice("If that email has an account, a password reset link is on its way.");
  }

  async function resendConfirmation() {
    if (!email) {
      setError("Type your email above first, then tap \"Resend confirmation email\".");
      return;
    }
    setError("");
    setNotice("");
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return setError(error.message);
    setNotice("Confirmation email resent — check your inbox.");
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-4 sm:px-6">
      <SEO title="Log in" path="/login" noindex />
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4">
        <Link href="/" className="font-display text-lg block mb-2">
          {SITE_NAME}
        </Link>
        <h1 className="font-display text-2xl mb-2">Log in</h1>
        <label className="block text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full mt-1 border border-line px-3 py-2 bg-paper"
          />
        </label>
        <label className="block text-sm">
          Password
          <div className="relative mt-1">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-line px-3 py-2 pr-16 bg-paper"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs underline text-wire"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {error && <p className="text-sm text-signal">{error}</p>}
        {notice && <p className="text-sm text-wire">{notice}</p>}
        <button
          disabled={loading}
          className="w-full py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-wire">
          <button type="button" onClick={forgotPassword} className="underline">
            Forgot password
          </button>
          <button type="button" onClick={resendConfirmation} className="underline">
            Resend confirmation email
          </button>
        </div>
        <p className="text-sm text-wire">
          No account?{" "}
          <Link href="/signup" className="underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
