"use client";
import { useState } from "react";
import { getSupabase } from "@/services/supabase-client";
export function SignIn() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const auth = getSupabase().auth;
      const result = sent
        ? await auth.verifyOtp({
            email: email.trim(),
            token: token.trim(),
            type: "email",
          })
        : await auth.signInWithOtp({ email: email.trim() });
      if (result.error) throw result.error;
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="empty-state">
      <h1>Sign in to Roomly</h1>
      <p>Use the email approved by your campus administrator.</p>
      <form className="signin-form" onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={sent || busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {sent && (
          <label>
            Email code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "Please wait…" : sent ? "Verify code" : "Send sign-in code"}
        </button>
        {sent && (
          <>
            <p>Check your email for the code or sign-in link.</p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setToken("");
              }}
            >
              Use another email / resend
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </form>
    </section>
  );
}
