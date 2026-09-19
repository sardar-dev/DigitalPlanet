import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4">
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
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full mt-1 border border-line px-3 py-2 bg-paper"
          />
        </label>
        {error && <p className="text-sm text-signal">{error}</p>}
        <button
          disabled={loading}
          className="w-full py-2 bg-ink text-paper hover:bg-wire transition-colors disabled:opacity-40"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
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
