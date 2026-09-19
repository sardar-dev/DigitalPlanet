import { useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      if (error.message?.toLowerCase().includes("rate limit")) {
        return setError(
          "Too many signups right now — please wait a few minutes and try again."
        );
      }
      return setError(error.message);
    }
    if (data.session) {
      // Email confirmation is disabled on this project — the user is
      // already signed in, no need to tell them to check their inbox.
      window.location.href = "/";
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="font-display text-2xl">Check your email</h1>
          <p className="text-sm text-wire">
            We sent a confirmation link to {email}. Confirm it, then log in.
          </p>
          <Link href="/login" className="underline text-sm">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4">
        <h1 className="font-display text-2xl mb-2">Create an account</h1>
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
            minLength={6}
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
          {loading ? "Creating…" : "Sign up"}
        </button>
        <p className="text-sm text-wire">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
