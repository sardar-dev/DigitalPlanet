import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // Supabase's client picks up the recovery session automatically
    // from the URL fragment the email link lands on.
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-4 sm:px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="font-display text-2xl">Password updated</h1>
          <a href="/login" className="underline text-sm">
            Go to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink font-body flex items-center justify-center px-4 sm:px-6">
      <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4">
        <h1 className="font-display text-2xl mb-2">Set a new password</h1>
        <label className="block text-sm">
          New password
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
          {loading ? "Saving…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
