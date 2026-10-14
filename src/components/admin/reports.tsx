"use client";
import { useState } from "react";
import { signedNaira } from "@/features/reports/rules";
type Data = {
  meta: {
    from: string;
    to: string;
    scope: string;
    page: number;
    snapshotAt: string;
    definitions: Record<string, string>;
  };
  summary: Record<string, number>;
  totalRows: number;
  orders?: {
    id: string;
    orderNumber: string;
    channel: string;
    totalKobo: number;
    paymentStatus: string;
    fulfilmentStatus: string;
  }[];
  variants?: Record<string, string | number | boolean>[];
};
const labels: Record<string, string> = {
  grossAppliedKobo: "Applied gross receipts",
  deliveryIncludedKobo: "Delivery included",
  refundsAppliedKobo: "Applied capture refunds",
  netAppliedFlowKobo: "Net applied flow",
  extraCapturedKobo: "Extra captures",
  extraRefundedKobo: "Extra capture refunds",
  paidOrders: "Orders paid in period",
  createdOrders: "Orders created in period",
  cancelledOfCreatedOrders: "Cancelled of created orders",
  handedOverOrders: "Orders handed over",
  physicalDelta: "Period physical movement",
  quarantineDelta: "Period quarantine movement",
  movements: "Period movements",
};
export function ReportsWorkspace({ today }: { today: string }) {
  const [kind, setKind] = useState("sales"),
    [from, setFrom] = useState(today.slice(0, 8) + "01"),
    [to, setTo] = useState(today),
    [scope, setScope] = useState("REAL"),
    [channel, setChannel] = useState("ALL"),
    [data, setData] = useState<Data | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const query = (page = 1) =>
    new URLSearchParams({
      from,
      to,
      scope,
      channel,
      page: String(page),
    }).toString();
  async function load(page = 1) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/reports/${kind}?${query(page)}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error?.message);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report unavailable.");
    } finally {
      setBusy(false);
    }
  }
  function edit() {
    setData(null);
    setError("");
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner business records</p>
          <h1>Reports & export</h1>
          <p>
            Lagos business dates. Real records are the default; demo records are
            separate. Amounts do not represent profit or bank settlement.
          </p>
        </div>
      </div>
      <form
        className="workspace-form"
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
      >
        <fieldset disabled={busy}>
          <div className="form-grid">
            <label>
              Report
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  if (e.target.value === "inventory") setChannel("ALL");
                  edit();
                }}
              >
                <option value="sales">Applied sales (payment date)</option>
                <option value="orders">Orders (creation date)</option>
                <option value="inventory">
                  Current stock and period movements
                </option>
              </select>
            </label>
            <label>
              Data scope
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  edit();
                }}
              >
                <option value="REAL">Real records</option>
                <option value="DEMO">Demo/test records</option>
              </select>
            </label>
            <label>
              From (inclusive)
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  edit();
                }}
                required
              />
            </label>
            <label>
              To (inclusive)
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  edit();
                }}
                required
              />
            </label>
            <label>
              Channel
              <select
                value={channel}
                disabled={kind === "inventory"}
                onChange={(e) => {
                  setChannel(e.target.value);
                  edit();
                }}
              >
                <option value="ALL">All channels</option>
                <option value="WALK_IN">Shop</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="WEBSITE">Website</option>
              </select>
            </label>
          </div>
          <button className="button">{busy ? "Loading…" : "Run report"}</button>
        </fieldset>
      </form>
      {error && <p role="alert">{error}</p>}
      {data && (
        <>
          <p className="notice">
            {data.meta.scope} · {data.meta.from} through {data.meta.to}{" "}
            inclusive, Africa/Lagos. Snapshot{" "}
            {new Date(data.meta.snapshotAt).toLocaleString("en-NG", {
              timeZone: "Africa/Lagos",
            })}
            . Page {data.meta.page}, {data.totalRows} matching rows.
          </p>
          <div className="stat-grid">
            {Object.entries(data.summary).map(([key, value]) => (
              <div className="stat-card" key={key}>
                <span>{labels[key] ?? key}</span>
                <strong>
                  {key.endsWith("Kobo") ? signedNaira(value) : value}
                </strong>
              </div>
            ))}
          </div>
          <details className="workspace-form">
            <summary>Metric definitions</summary>
            {Object.entries(data.meta.definitions).map(([k, v]) => (
              <p key={k}>
                <strong>{labels[k] ?? k}</strong>: {v}
              </p>
            ))}
            <p>
              Refunds use confirmation time and can relate to earlier sales.
              Inventory is a current snapshot, not historical stock at the
              selected end date.
            </p>
          </details>
          {data.orders && (
            <div className="workspace-form table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Channel</th>
                    <th>Saved total</th>
                    <th>Payment</th>
                    <th>Fulfilment</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.id}>
                      <td>{o.orderNumber}</td>
                      <td>{o.channel}</td>
                      <td>{signedNaira(o.totalKobo)}</td>
                      <td>{o.paymentStatus}</td>
                      <td>{o.fulfilmentStatus}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.variants && (
            <div className="workspace-form table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Physical</th>
                    <th>Quarantine</th>
                    <th>Held</th>
                    <th>Committed</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data.variants.map((v) => (
                    <tr key={String(v.id)}>
                      {[
                        v.sku,
                        v.name,
                        v.physicalQty,
                        v.quarantinedQty,
                        v.heldQty,
                        v.committedQty,
                        v.availableQty,
                      ].map((cell, i) => (
                        <td key={i}>{String(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.totalRows === 0 && (
            <p>
              No matching records. Change the range or explicitly choose demo
              data.
            </p>
          )}
          <div className="workspace-title">
            <button
              className="text-link"
              disabled={busy || data.meta.page <= 1}
              onClick={() => load(data.meta.page - 1)}
            >
              Previous
            </button>
            <a
              className="button"
              href={`/api/admin/reports/${kind}?${query(data.meta.page)}&format=csv`}
            >
              Download this page as CSV
            </a>
            <button
              className="text-link"
              disabled={busy || data.meta.page * 50 >= data.totalRows}
              onClick={() => load(data.meta.page + 1)}
            >
              Next
            </button>
          </div>
          <p>
            CSV contains summary totals and this page only. It omits customer
            contact details and costs.
          </p>
        </>
      )}
    </>
  );
}
