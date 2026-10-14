"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useOperation } from "./request";
type Health = {
  snapshotAt: string;
  demoStore: boolean;
  configured: Record<string, boolean>;
  counts: Record<string, number>;
  jobs: {
    id: string;
    name: string;
    state: string;
    attempts: number;
    errorCode: string | null;
    startedAt: string;
  }[];
  events: {
    id: string;
    reference: string;
    eventType: string;
    result: string;
  }[];
  remainingEvidence: string[];
};
export function OperationsWorkspace() {
  const [data, setData] = useState<Health | null>(null),
    [error, setError] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch("/api/admin/operations", { cache: "no-store" });
    if (!r.ok) throw Error("Operations could not load.");
    setData(await r.json());
  }
  useEffect(() => {
    void fetch("/api/admin/operations", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Operations could not load.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner operating controls</p>
          <h1>Operations & readiness</h1>
          <p>
            These are observed records and configured fields. They do not
            approve a launch or prove that business information is verified.
          </p>
        </div>
        <button
          className="text-link"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
      </div>
      {data ? (
        <>
          <p className="notice">
            {data.demoStore ? "Demonstration store" : "Real-data store"} · Live
            online payments remain disabled. Real
            merchant/browser/media/operator evidence remains pending.
          </p>
          <div className="stat-grid">
            {Object.entries(data.counts).map(([k, v]) => (
              <div className="stat-card" key={k}>
                <span>{k.replace(/([A-Z])/g, " $1")}</span>
                <strong>{v}</strong>
              </div>
            ))}
          </div>
          <section className="workspace-form">
            <h2>Configuration observed</h2>
            {Object.entries(data.configured).map(([k, v]) => (
              <p key={k}>
                {k.replace(/([A-Z])/g, " $1")}:{" "}
                <strong>
                  {v ? "Configured — verify separately" : "Not configured"}
                </strong>
              </p>
            ))}
            <Link href="/admin/settings">
              Edit business contact/policy fields
            </Link>{" "}
            · <Link href="/staff/security">Set up authenticator</Link>
          </section>
          <section className="workspace-form">
            <h2>Run bounded jobs</h2>
            <p>
              Each new run processes a bounded batch. Retry an uncertain request
              with the same key. Machine jobs require a separate private
              credential and selected-host scheduling.
            </p>
            {["payments", "expiry", "outbox"].map((kind) => (
              <button
                className="text-link"
                key={kind}
                disabled={op.busy || op.uncertain}
                onClick={async () => {
                  if (await op.submit(`/api/admin/jobs/${kind}`, {}))
                    await load();
                }}
              >
                {kind}
              </button>
            ))}
            {op.uncertain && (
              <button
                className="button"
                onClick={async () => {
                  if (await op.submit("", {})) await load();
                }}
              >
                Retry same job
              </button>
            )}
            {op.message && <p role="alert">{op.message}</p>}
          </section>
          <section className="workspace-form">
            <h2>Recent job runs</h2>
            {data.jobs.length ? (
              data.jobs.map((j) => (
                <p key={j.id}>
                  {j.name} · {j.state} · {j.attempts} attempt(s) ·{" "}
                  {j.errorCode ?? "No recorded job error"}
                </p>
              ))
            ) : (
              <p>No job runs recorded.</p>
            )}
          </section>
          <section className="workspace-form">
            <h2>Provider observations needing review</h2>
            <p>
              Current provider integration is test-only. Unknown/mismatched
              references and refund conflicts need investigation, not an
              invented order.
            </p>
            {data.events.length ? (
              data.events.map((e) => (
                <p key={e.id}>
                  {e.reference} · {e.eventType} · {e.result}
                </p>
              ))
            ) : (
              <p>No exception observations recorded.</p>
            )}
            <Link href="/admin/payments">Open payment resolution</Link>
          </section>
          <section className="workspace-form">
            <h2>Required operating evidence</h2>
            {data.remainingEvidence.map((e) => (
              <p key={e}>Pending: {e}</p>
            ))}
          </section>
        </>
      ) : (
        <p role="status">{error || "Loading observed operating state…"}</p>
      )}
    </>
  );
}
