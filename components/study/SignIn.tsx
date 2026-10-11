"use client";

import { useState } from "react";
import { getSupabase } from "@/services/supabase-client";

type Stage = "email" | "otp" | "access";

// One flow for everyone: any email receives a six-digit code, then a new account
// enters the campus access code once. The server enforces access, not this form.

export function SignIn({
  hasSession,
  onComplete,
}: {
  hasSession: boolean;
  onComplete: () => Promise<void> | void;
}) {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [stage, setStage] = useState<Stage>(hasSession ? "access" : "email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function resetIdentity() {
    setBusy(true);
    setError("");
    try {
      await getSupabase().auth.signOut();
      setEmail("");
      setToken("");
      setAccessCode("");
      setStage("email");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign out.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const client = getSupabase();

      if (stage === "access") {
        const { error: accessError } = await client.rpc("roomly_claim_access", {
          invite_code: accessCode.trim().toUpperCase(),
        });
        if (accessError) throw accessError;
        await onComplete();
        return;
      }

      if (stage === "otp") {
        const result = await client.auth.verifyOtp({
          email: email.trim().toLowerCase(),
          token: token.trim(),
          type: "email",
        });
        if (result.error) throw result.error;

        const { data: access, error: accessError } = await client.rpc(
          "roomly_access_status",
        );
        if (accessError) throw accessError;

        if (access === true) await onComplete();
        else setStage("access");
        return;
      }

      const address = email.trim().toLowerCase();
      const result = await client.auth.signInWithOtp({
        email: address,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (result.error) throw result.error;
      setStage("otp");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="signin-form" onSubmit={submit}>
      {stage === "email" && (
        <>
          <p>
            Enter your email address and we&rsquo;ll send you a verification
            code.
          </p>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              disabled={busy}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </label>
        </>
      )}

      {stage === "otp" && (
        <>
          <p>
            Check your inbox for the Roomly email and enter the six-digit code
            below. No email after a minute? Look in your spam or junk folder.
          </p>
          <label>
            6-digit email code
            <input
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={token}
              disabled={busy}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
            />
          </label>
        </>
      )}

      {stage === "access" && (
        <>
          <p>
            Your email is verified. Enter the campus access code once to enable
            check-ins, bookings and alerts on this account.
          </p>
          <label>
            Access code
            <input
              type="text"
              autoComplete="off"
              required
              value={accessCode}
              disabled={busy}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Access code"
            />
          </label>
        </>
      )}

      <button className="primary-button full" disabled={busy}>
        {busy
          ? "Please wait…"
          : stage === "email"
            ? "Send sign-in code"
            : stage === "otp"
              ? "Verify code"
              : "Unlock room actions"}
      </button>

      {stage === "otp" && (
        <button
          type="button"
          className="secondary-button full"
          disabled={busy}
          onClick={() => {
            setToken("");
            setStage("email");
          }}
        >
          Change email / resend
        </button>
      )}

      {stage === "access" && (
        <button
          type="button"
          className="secondary-button full"
          disabled={busy}
          onClick={() => void resetIdentity()}
        >
          Use another email
        </button>
      )}

      <p className="small-note">
        The verification code is one-time use. After a successful sign-in, your
        browser keeps a Supabase session so you do not need a code on every
        visit.
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
