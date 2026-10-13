"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
export function SignInForm({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  const router = useRouter();
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !configured) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await authClient.signIn.email({
        email: String(data.get("email")).trim(),
        password: String(data.get("password")),
      });
      if (result.error) {
        setError(
          result.error.status === 429
            ? "Too many attempts. Please wait a minute and try again."
            : "We couldn’t sign you in. Check your details or try again shortly.",
        );
      } else {
        router.replace("/admin");
        router.refresh();
      }
    } catch {
      setError("We couldn’t connect. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="sign-in-form">
      {!configured && (
        <p className="notice" role="status">
          Staff sign-in is temporarily unavailable. Please contact the store
          owner.
        </p>
      )}
      <label htmlFor="email">Email address</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="username"
        placeholder="you@example.com"
        disabled={!configured || busy}
      />
      <label htmlFor="password">Password</label>
      <div className="password-field">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          minLength={12}
          maxLength={128}
          autoComplete="current-password"
          disabled={!configured || busy}
        />
        <button
          type="button"
          className="icon-button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <button type="submit" className="button" disabled={busy || !configured}>
        {busy ? (
          <>
            <LoaderCircle className="spin" size={17} /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight size={18} />
          </>
        )}
      </button>
      <p className="form-help">
        Access is provided by the store owner. There is no public staff
        registration.
      </p>
    </form>
  );
}
