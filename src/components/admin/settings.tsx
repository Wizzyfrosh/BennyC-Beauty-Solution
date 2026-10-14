"use client";
import { useEffect, useState } from "react";
import { useOperation } from "./request";
const fields = [
  "phone",
  "email",
  "whatsapp",
  "pickupAddress",
  "businessHours",
  "privacyPolicy",
  "returnsPolicy",
  "deliveryPolicy",
] as const;
export function StoreSettingsWorkspace() {
  const [data, setData] = useState<Record<string, string | null> | null>(null),
    [error, setError] = useState("");
  const op = useOperation();
  useEffect(() => {
    void fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Business settings could not load.");
        const d = await r.json();
        setData(Object.fromEntries(fields.map((k) => [k, d[k] ?? ""])));
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner-provided business information</p>
          <h1>Contact & policies</h1>
          <p>
            Enter verified shop information and owner-approved text. These
            fields do not enable payments or turn demo records into real
            records.
          </p>
        </div>
      </div>
      {data ? (
        <form
          className="workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const reason = String(new FormData(e.currentTarget).get("reason"));
            if (await op.submit("/api/admin/settings", { ...data, reason }))
              setError("Settings saved. Verify public content before release.");
          }}
        >
          <fieldset disabled={op.busy || op.uncertain}>
            {fields.map((k) => (
              <label key={k}>
                {k.replace(/([A-Z])/g, " $1")}
                {k.endsWith("Policy") || k === "pickupAddress" ? (
                  <textarea
                    maxLength={k.endsWith("Policy") ? 10000 : 500}
                    value={data[k] ?? ""}
                    onChange={(e) => setData({ ...data, [k]: e.target.value })}
                  />
                ) : (
                  <input
                    type={k === "email" ? "email" : "text"}
                    value={data[k] ?? ""}
                    maxLength={
                      k === "businessHours" ? 250 : k === "email" ? 254 : 20
                    }
                    onChange={(e) => setData({ ...data, [k]: e.target.value })}
                  />
                )}
              </label>
            ))}
            <label>
              Reason for change
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
          </fieldset>
          <button className="button" disabled={op.busy}>
            {op.uncertain ? "Retry same save" : "Save verified settings"}
          </button>
          {(error || op.message) && <p role="status">{op.message || error}</p>}
        </form>
      ) : (
        <p role="status">{error || "Loading settings…"}</p>
      )}
    </>
  );
}
export function StaffWorkspace() {
  const [staff, setStaff] = useState<
      | {
          userId: string;
          role: string;
          active: boolean;
          user: { name: string; email: string };
        }[]
      | null
    >(null),
    [error, setError] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch("/api/admin/staff", { cache: "no-store" });
    if (!r.ok) throw Error("Staff could not load.");
    setStaff(await r.json());
  }
  useEffect(() => {
    void fetch("/api/admin/staff", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Staff could not load.");
        setStaff(await r.json());
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner access management</p>
          <h1>Staff access</h1>
          <p>
            Provision new accounts in a private terminal. Any role/activity
            change revokes that user&apos;s sessions. The last active owner cannot be
            removed.
          </p>
        </div>
      </div>
      {staff?.map((s) => (
        <form
          className="workspace-form"
          key={`${s.userId}:${s.role}:${s.active}`}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            if (
              await op.submit("/api/admin/staff", {
                userId: s.userId,
                role: String(form.get("role")),
                active: form.get("active") === "on",
                reason: String(form.get("reason")),
              })
            )
              await load().catch((e) => setError(e.message));
          }}
        >
          <h2>{s.user.name}</h2>
          <p>{s.user.email}</p>
          <fieldset disabled={op.busy || op.uncertain}>
            <label>
              Role
              <select name="role" defaultValue={s.role}>
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            <label>
              <input name="active" type="checkbox" defaultChecked={s.active} />{" "}
              Active
            </label>
            <label>
              Reason
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
            <button className="button">Save and revoke old sessions</button>
          </fieldset>
        </form>
      ))}
      {staff?.length === 0 && <p>No staff found.</p>}
      {op.uncertain && (
        <button
          className="button"
          onClick={async () => {
            if (await op.submit("", {})) await load();
          }}
        >
          Retry same access change
        </button>
      )}
      {(error || op.message) && <p role="alert">{op.message || error}</p>}
    </>
  );
}
