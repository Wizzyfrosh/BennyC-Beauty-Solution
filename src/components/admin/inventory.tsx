"use client";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { nairaToKobo, useOperation } from "./request";
export type InventoryData = {
  variants: {
    id: string;
    sku: string;
    priceKobo: number;
    lowStockThreshold: number;
    availableQty: number;
    active: boolean;
    product: { name: string; isDemo: boolean; status: string };
  }[];
  batches: {
    id: string;
    batchCode: string;
    receiptReference: string;
    onHandQty: number;
    quarantinedQty: number;
    expiryLabel: string | null;
    expiryPrecision: string;
    expiryDate: string | null;
    cost?: { unitCostKobo: number } | null;
    variant: { sku: string; product: { name: string } };
  }[];
  movements: {
    id: string;
    createdAt: string;
    movementType: string;
    onHandDelta: number;
    quarantineDelta: number;
    reason: string;
    batch: { batchCode: string; variant: { sku: string } };
    actor: { name: string };
  }[];
  counts: {
    physical: number;
    quarantined: number;
    expired: number;
    nearExpiry: number;
  };
  limits: { variants: number; batches: number; movements: number };
};
export function InventoryWorkspace({ owner }: { owner: boolean }) {
  const [data, setData] = useState<InventoryData | null>(null),
    [error, setError] = useState("");
  async function load() {
    const r = await fetch("/api/admin/inventory");
    const d = await r.json();
    if (!r.ok) throw Error();
    setData(d);
  }
  useEffect(() => {
    void fetch("/api/admin/inventory")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error();
        setData(d);
      })
      .catch(() => setError("Inventory could not load. Please retry."));
  }, []);
  if (error)
    return (
      <p role="alert" className="notice">
        {error}
        <button
          className="outline-button"
          onClick={() => {
            setError("");
            void load().catch(() => setError("Inventory could not load."));
          }}
        >
          Retry
        </button>
      </p>
    );
  if (!data) return <p role="status">Loading inventory…</p>;
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Stock workspace</p>
          <h1>Inventory</h1>
          <p>Physical stock, quarantine, expiry and receiving history.</p>
        </div>
      </div>
      <div className="stat-grid">
        {[
          ["Physical units", data.counts.physical],
          ["Quarantined units", data.counts.quarantined],
          ["Expired units", data.counts.expired],
          ["Expiring within 30 days", data.counts.nearExpiry],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="workspace-columns">
        <ReceiveForm data={data} owner={owner} done={load} />
        {owner && <AdjustmentForm data={data} done={load} />}
      </div>
      <h2 className="table-title">Stock by option</h2>
      <p className="form-help">
        First {data.limits.variants} options by SKU. Available excludes
        quarantined, expired and unresolved-expiry units.
      </p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product / SKU</th>
              <th>Available</th>
              <th>Threshold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.variants.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.product.name}</strong>
                  <small>
                    {v.sku}
                    {v.product.isDemo ? " · Sample" : ""}
                  </small>
                </td>
                <td>{v.availableQty}</td>
                <td>{v.lowStockThreshold}</td>
                <td>
                  {!v.active
                    ? "Inactive"
                    : v.product.status !== "PUBLISHED"
                      ? "Unpublished"
                      : v.availableQty <= v.lowStockThreshold
                        ? "Low stock"
                        : "Saleable stock"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="table-title">Latest {data.limits.batches} batches</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Batch / SKU</th>
              <th>Physical</th>
              <th>Quarantined</th>
              <th>Printed expiry</th>
              {owner && <th>Unit cost</th>}
            </tr>
          </thead>
          <tbody>
            {data.batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{b.batchCode}</strong>
                  <small>
                    {b.variant.sku} · {b.receiptReference}
                  </small>
                </td>
                <td>{b.onHandQty}</td>
                <td>{b.quarantinedQty}</td>
                <td>
                  {b.expiryLabel ??
                    (b.expiryPrecision === "NOT_APPLICABLE"
                      ? "Not applicable"
                      : "Unresolved")}
                </td>
                {owner && (
                  <td>
                    {b.cost ? formatNaira(b.cost.unitCostKobo) : "Not recorded"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!data.batches.length && (
          <p className="table-empty">No stock has been received.</p>
        )}
      </div>
      <h2 className="table-title">
        Latest {data.limits.movements} stock movements
      </h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Action / batch</th>
              <th>Physical change</th>
              <th>Quarantine change</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {data.movements.map((m) => (
              <tr key={m.id}>
                <td>
                  <strong>
                    {m.movementType.toLowerCase().replaceAll("_", " ")} ·{" "}
                    {m.batch.batchCode}
                  </strong>
                  <small>
                    {m.reason} · {m.batch.variant.sku}
                  </small>
                </td>
                <td>
                  {m.onHandDelta > 0 ? "+" : ""}
                  {m.onHandDelta}
                </td>
                <td>
                  {m.quarantineDelta > 0 ? "+" : ""}
                  {m.quarantineDelta}
                </td>
                <td>
                  {m.actor.name}
                  <small>
                    {new Date(m.createdAt).toLocaleString("en-NG", {
                      timeZone: "Africa/Lagos",
                    })}
                  </small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
function ReceiveForm({
  data,
  owner,
  done,
}: {
  data: InventoryData;
  owner: boolean;
  done: () => Promise<void>;
}) {
  const op = useOperation();
  const [precision, setPrecision] = useState("DAY"),
    [localError, setLocalError] = useState(""),
    [success, setSuccess] = useState("");
  return (
    <form
      className="workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setSuccess("");
        setLocalError("");
        const element = e.currentTarget;
        const f = new FormData(element);
        try {
          const body = {
            variantId: f.get("variantId"),
            batchCode: f.get("batchCode"),
            receiptReference: f.get("receiptReference"),
            quantity: Number(f.get("quantity")),
            expiryPrecision: precision,
            expiryLabel: f.get("expiryLabel") || null,
            quarantine: f.has("quarantine"),
            ...(owner && f.get("cost")
              ? { unitCostKobo: nairaToKobo(String(f.get("cost"))) }
              : {}),
          };
          const r = await op.submit("/api/admin/inventory/receipts", body);
          if (r) {
            setSuccess(
              `Stock received: ${r.onHandQty} physical, ${r.quarantinedQty} quarantined.`,
            );
            element.reset();
            await done();
          }
        } catch (err) {
          setLocalError(
            err instanceof Error ? err.message : "Check the receipt.",
          );
        }
      }}
    >
      <h2>Receive stock</h2>
      <fieldset disabled={op.busy || op.uncertain}>
        <label>
          Product option
          <select name="variantId" required>
            {data.variants
              .filter((v) => v.active)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.sku} — {v.product.name}
                </option>
              ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Batch code
            <input name="batchCode" required maxLength={100} />
          </label>
          <label>
            Receipt reference
            <input name="receiptReference" required maxLength={100} />
          </label>
          <label>
            Units received
            <input
              name="quantity"
              type="number"
              min="1"
              max="100000"
              required
            />
          </label>
          <label>
            Printed expiry format
            <select
              value={precision}
              onChange={(e) => setPrecision(e.target.value)}
            >
              <option value="DAY">Exact date</option>
              <option value="MONTH">Month only</option>
              <option value="NOT_APPLICABLE">Not applicable</option>
            </select>
          </label>
          {precision !== "NOT_APPLICABLE" && (
            <label>
              Printed expiry
              <input
                name="expiryLabel"
                type={precision === "MONTH" ? "month" : "date"}
              />
            </label>
          )}
          {owner && (
            <label>
              Unit purchase cost (₦, optional)
              <input name="cost" type="number" min="0" step="0.01" />
            </label>
          )}
        </div>
        <label className="checkbox-label">
          <input name="quarantine" type="checkbox" /> Quarantine pending
          inspection
        </label>
        <p className="form-help">
          Expired, unknown or month-only expiry stock stays unavailable until
          resolved. Accessories can use “Not applicable” if their product does
          not require expiry.
        </p>
      </fieldset>
      {(op.message || localError) && (
        <p role="alert" className="form-error">
          {op.message || localError}
        </p>
      )}
      {success && (
        <p role="status" className="notice">
          {success}
        </p>
      )}
      <button className="button" disabled={op.busy}>
        {op.busy
          ? "Recording…"
          : op.uncertain
            ? "Retry same receipt"
            : "Record receipt"}
      </button>
    </form>
  );
}
function AdjustmentForm({
  data,
  done,
}: {
  data: InventoryData;
  done: () => Promise<void>;
}) {
  const op = useOperation();
  const [action, setAction] = useState("COUNT"),
    [success, setSuccess] = useState("");
  return (
    <form
      className="workspace-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setSuccess("");
        const result = await op.submit("/api/admin/inventory/adjustments", {
          batchId: f.get("batchId"),
          action,
          quantity: Number(f.get("quantity")),
          reason: f.get("reason"),
        });
        if (result) {
          setSuccess("Stock adjustment recorded with its history.");
          await done();
        }
      }}
    >
      <h2>Owner stock adjustment</h2>
      <fieldset disabled={op.busy || op.uncertain}>
        <label>
          Batch
          <select name="batchId" required>
            {data.batches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.batchCode} · {b.variant.sku}
              </option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="COUNT">Reconcile physical count</option>
            <option value="QUARANTINE">Quarantine units</option>
            <option value="RELEASE">Release inspected units</option>
            <option value="WRITE_OFF">Write off quarantined units</option>
          </select>
        </label>
        <label>
          {action === "COUNT" ? "New physical count" : "Units"}
          <input
            name="quantity"
            type="number"
            min={action === "COUNT" ? 0 : 1}
            max="100000"
            required
          />
        </label>
        <label>
          Reason
          <textarea name="reason" required minLength={5} maxLength={500} />
        </label>
        <p className="form-help">
          Corrections add a new history entry. Expired or unresolved-expiry
          units cannot be released for sale.
        </p>
      </fieldset>
      {op.message && (
        <p className="form-error" role="alert">
          {op.message}
        </p>
      )}
      {success && (
        <p className="notice" role="status">
          {success}
        </p>
      )}
      <button className="button" disabled={op.busy || !data.batches.length}>
        {op.busy
          ? "Recording…"
          : op.uncertain
            ? "Retry same adjustment"
            : "Record adjustment"}
      </button>
    </form>
  );
}
