"use client";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { useOperation } from "./request";
import type { InventoryData } from "./inventory";
type Receipt = { orderNumber: string; totalKobo: number; isDemo: boolean };
type Sale = {
  id: string;
  orderNumber: string;
  channel: string;
  totalKobo: number;
  isDemo: boolean;
  createdAt: string;
  items: { productNameSnapshot: string; quantity: number }[];
};
export function SaleWorkspace() {
  const [data, setData] = useState<InventoryData | null>(null),
    [sales, setSales] = useState<Sale[]>([]),
    [error, setError] = useState("");
  const [lines, setLines] = useState<{ variantId: string; quantity: number }[]>(
    [{ variantId: "", quantity: 1 }],
  );
  const [method, setMethod] = useState("CASH"),
    [receipt, setReceipt] = useState<Receipt | null>(null);
  const op = useOperation();
  useEffect(() => {
    void Promise.all([fetch("/api/admin/inventory"), fetch("/api/admin/sales")])
      .then(async ([r, s]) => {
        if (!r.ok || !s.ok) throw Error();
        setData(await r.json());
        setSales(await s.json());
      })
      .catch(() =>
        setError(
          "Products and recent sales could not load. Reload this page to retry.",
        ),
      );
  }, []);
  if (error)
    return (
      <p className="notice" role="alert">
        {error}
      </p>
    );
  if (!data) return <p role="status">Loading sale options…</p>;
  const choices = data.variants.filter(
    (v) => v.active && v.product.status === "PUBLISHED",
  );
  const total = lines.reduce(
    (sum, line) =>
      sum +
      (choices.find((v) => v.id === line.variantId)?.priceKobo ?? 0) *
        line.quantity,
    0,
  );
  const demo = lines.some(
    (line) => choices.find((v) => v.id === line.variantId)?.product.isDemo,
  );
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Shop & WhatsApp sales</p>
          <h1>Record a completed sale</h1>
          <p>Confirm actual payment and handover before recording.</p>
        </div>
      </div>
      {receipt ? (
        <div className="workspace-form">
          <span className="status-pill">
            {receipt.isDemo ? "Demo sale" : "Sale recorded"}
          </span>
          <h2>{receipt.orderNumber}</h2>
          <p className="detail-price">{formatNaira(receipt.totalKobo)}</p>
          <p>
            Payment confirmation, handoff and stock history were recorded
            together.
          </p>
          <button
            className="button"
            onClick={() => {
              setReceipt(null);
              setLines([{ variantId: "", quantity: 1 }]);
            }}
          >
            Record another sale
          </button>
        </div>
      ) : (
        <form
          className="workspace-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const result = await op.submit("/api/admin/sales", {
              channel: f.get("channel"),
              items: lines,
              expectedTotalKobo: total,
              payment: {
                method,
                confirmed: f.has("confirmed"),
                ...(f.get("reference")
                  ? { reference: f.get("reference") }
                  : {}),
              },
            });
            if (result) {
              setReceipt(result);
              const r = await fetch("/api/admin/inventory");
              if (r.ok) setData(await r.json());
              const s = await fetch("/api/admin/sales");
              if (s.ok) setSales(await s.json());
            }
          }}
        >
          <fieldset disabled={op.busy || op.uncertain}>
            <label>
              Sales channel
              <select name="channel">
                <option value="WALK_IN">Walk-in shop sale</option>
                <option value="WHATSAPP">Completed WhatsApp sale</option>
              </select>
            </label>
            <h2>Sale basket</h2>
            {lines.map((line, i) => (
              <div className="sale-line" key={i}>
                <label>
                  Product option
                  <select
                    required
                    value={line.variantId}
                    onChange={(e) =>
                      setLines((old) =>
                        old.map((v, n) =>
                          n === i ? { ...v, variantId: e.target.value } : v,
                        ),
                      )
                    }
                  >
                    <option value="">Choose an option</option>
                    {choices
                      .filter(
                        (v) =>
                          v.id === line.variantId ||
                          !lines.some((l) => l.variantId === v.id),
                      )
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.sku} — {v.product.name} · {v.availableQty}{" "}
                          available · {formatNaira(v.priceKobo)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Units
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((old) =>
                        old.map((v, n) =>
                          n === i
                            ? { ...v, quantity: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="outline-button"
                  disabled={lines.length === 1}
                  onClick={() => setLines(lines.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="outline-button"
              disabled={lines.length >= 20}
              onClick={() =>
                setLines([...lines, { variantId: "", quantity: 1 }])
              }
            >
              Add another item
            </button>
            <p className="detail-price">
              Total:{" "}
              {formatNaira(
                Number.isSafeInteger(total) && total >= 0 ? total : 0,
              )}
            </p>
            {demo && (
              <p className="notice">
                This is a sample basket. It will create a labelled demo sale and
                must not be treated as real money received.
              </p>
            )}
            <div className="form-grid">
              <label>
                Confirmed payment channel
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="POS">POS</option>
                </select>
              </label>
              {method !== "CASH" && (
                <label>
                  Confirmed payment reference
                  <input name="reference" required maxLength={100} />
                </label>
              )}
            </div>
            <label className="checkbox-label">
              <input name="confirmed" type="checkbox" required />{" "}
              {demo
                ? "I confirm this is a demonstration payment and handoff"
                : "I verified the actual payment and handed over these products"}
            </label>
            <p className="form-help">
              A promised transfer or payment screenshot alone is not payment
              confirmation. Stock is deducted once when this completed sale is
              recorded.
            </p>
          </fieldset>
          {op.message && (
            <p className="form-error" role="alert">
              {op.message}
            </p>
          )}
          <button className="button" disabled={op.busy || total <= 0}>
            {op.busy
              ? "Recording sale…"
              : op.uncertain
                ? "Retry same sale"
                : "Record completed sale"}
          </button>
        </form>
      )}
      <h2 className="table-title">Latest 30 completed sales</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Items</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s) => (
              <tr key={s.id}>
                <td>
                  <strong>{s.orderNumber}</strong>
                  <small>
                    {s.channel.toLowerCase().replaceAll("_", " ")}
                    {s.isDemo ? " · Demo" : ""}
                  </small>
                </td>
                <td>
                  {s.items
                    .map((i) => `${i.quantity} × ${i.productNameSnapshot}`)
                    .join(", ")}
                </td>
                <td>{formatNaira(s.totalKobo)}</td>
                <td>
                  {new Date(s.createdAt).toLocaleString("en-NG", {
                    timeZone: "Africa/Lagos",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales.length && (
          <p className="table-empty">No completed sales have been recorded.</p>
        )}
      </div>
    </>
  );
}
