"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
export function MfaChallenge() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [backup, setBackup] = useState(false);
  const router = useRouter();
  return (
    <section className="container page-section reading-page">
      <p className="eyebrow">Private staff access</p>
      <h1>Verify your authenticator</h1>
      <form
        className="workspace-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const code = String(new FormData(e.currentTarget).get("code"));
          try {
            const r = backup
              ? await authClient.twoFactor.verifyBackupCode({
                  code,
                  trustDevice: false,
                })
              : await authClient.twoFactor.verifyTotp({
                  code,
                  trustDevice: false,
                });
            if (r.error)
              setError(
                "Verification failed or is temporarily locked. Check your code and try again later.",
              );
            else {
              router.replace("/admin");
              router.refresh();
            }
          } catch {
            setError("Verification could not complete. Retry safely.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          {backup ? "One-time recovery code" : "Six-digit authenticator code"}
          <input
            name="code"
            required
            autoComplete="one-time-code"
            inputMode={backup ? "text" : "numeric"}
            pattern={backup ? undefined : "[0-9]{6}"}
            maxLength={100}
            disabled={busy}
          />
        </label>
        <button className="button" disabled={busy}>
          Verify
        </button>
        <button
          type="button"
          className="text-link"
          onClick={() => setBackup(!backup)}
        >
          {backup ? "Use authenticator" : "Use a recovery code"}
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
      <Link href="/staff/sign-in">Back to sign in</Link>
    </section>
  );
}
export function MfaSetup({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<{
      secret: string;
      codes: string[];
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(enabled);
  return (
    <section className="container page-section reading-page">
      <p className="eyebrow">Account security</p>
      <h1>Authenticator protection</h1>
      <p>
        Production owner access requires verified authenticator protection.
        Setup secrets and recovery codes stay on this screen only; keep them
        private.
      </p>
      {done ? (
        <p className="notice">
          Authenticator protection is enabled. Keep your saved recovery codes
          secure. Password recovery preserves your authenticator.
        </p>
      ) : setup ? (
        <form
          className="workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const r = await authClient.twoFactor.verifyTotp({
                code: String(new FormData(e.currentTarget).get("code")),
                trustDevice: false,
              });
              if (r.error)
                setError("The authenticator code could not be verified.");
              else {
                setDone(true);
                setSetup(null);
              }
            } catch {
              setError("Verification failed. Try again safely.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Add a time-based account in your authenticator app (6 digits, 30
            seconds).
          </p>
          <label>
            Manual setup key
            <input readOnly value={setup.secret} autoComplete="off" />
          </label>
          <p>Save these one-time recovery codes privately before continuing:</p>
          <div className="recovery-codes">
            {setup.codes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <label>
            Current authenticator code
            <input
              name="code"
              required
              pattern="[0-9]{6}"
              autoComplete="one-time-code"
              inputMode="numeric"
            />
          </label>
          <button className="button" disabled={busy}>
            Verify and enable
          </button>
        </form>
      ) : (
        <form
          className="workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = e.currentTarget,
              password = String(new FormData(form).get("password"));
            try {
              const r = await authClient.twoFactor.enable({ password });
              form.reset();
              if (r.error)
                setError(
                  "Setup could not begin. Confirm your password or contact the owner.",
                );
              else if (
                r.data &&
                "totpURI" in r.data &&
                typeof r.data.totpURI === "string" &&
                "backupCodes" in r.data
              ) {
                const uri = new URL(r.data.totpURI);
                setSetup({
                  secret: uri.searchParams.get("secret") ?? "",
                  codes: r.data.backupCodes ?? [],
                });
              }
            } catch {
              setError("Setup is temporarily unavailable.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Current password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              maxLength={128}
            />
          </label>
          <button className="button" disabled={busy}>
            Set up authenticator
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <Link href="/admin">Go to staff workspace</Link>
    </section>
  );
}
