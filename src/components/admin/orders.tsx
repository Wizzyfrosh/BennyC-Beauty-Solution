"use client";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import type { OrderView } from "../order-status";
import { useOperation, nairaToKobo } from "./request";
export function OrdersWorkspace() {
  const [orders, setOrders] = useState<OrderView[] | null>(null),
    [error, setError] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch("/api/admin/orders", { cache: "no-store" });
    if (!r.ok) throw Error("Orders could not load. Reload to retry.");
    setOrders(await r.json());
  }
  useEffect(() => {
    void fetch("/api/admin/orders", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Orders could not load. Reload to retry.");
        return r.json();
      })
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);
  async function advance(order: OrderView, target: string) {
    if (await op.submit(`/api/admin/orders/${order.id}`, { target }, "PATCH"))
      await load().catch((e) => setError(e.message));
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Customer fulfilment</p>
          <h1>Website orders</h1>
          <p>
            Latest 50 orders. Payment and fulfilment are tracked separately.
          </p>
        </div>
        <button
          className="text-link"
          onClick={() => load().catch((e) => setError(e.message))}
        >
          Refresh
        </button>
      </div>
      {orders === null ? (
        <p role="status">{error || "Loading orders…"}</p>
      ) : !orders.length ? (
        <p className="notice">No website orders yet.</p>
      ) : (
        orders.map((o) => {
          const next =
            o.fulfilmentStatus === "UNFULFILLED"
              ? "PREPARING"
              : o.fulfilmentStatus === "PREPARING"
                ? o.fulfilmentMethod === "pickup"
                  ? "READY_FOR_PICKUP"
                  : "DISPATCHED"
                : o.fulfilmentStatus === "READY_FOR_PICKUP" ||
                    o.fulfilmentStatus === "DISPATCHED"
                  ? "COMPLETED"
                  : null;
          return (
            <article className="workspace-form" key={o.id}>
              <div className="workspace-title">
                <h2>{o.orderNumber}</h2>
                {o.isDemo && (
                  <span className="sample-label">Simulated demo</span>
                )}
              </div>
              <p>
                {o.paymentStatus} · {o.fulfilmentStatus.replaceAll("_", " ")} ·{" "}
                {o.fulfilmentMethod}
              </p>
              <p>
                {o.customerName} · {o.customerPhone} · {o.customerEmail}
              </p>
              {o.addressSnapshot && (
                <p>{Object.values(o.addressSnapshot).join(", ")}</p>
              )}
              {o.items.map((i, n) => (
                <p key={n}>
                  {i.quantity} × {i.productNameSnapshot} · {i.skuSnapshot}
                </p>
              ))}
              <p>
                <strong>{formatNaira(o.totalKobo)}</strong>
              </p>
              {next && o.paymentStatus === "PAID" && (
                <button
                  className="button"
                  disabled={op.busy || op.uncertain}
                  onClick={() => advance(o, next)}
                >
                  {next === "DISPATCHED"
                    ? "Dispatch and hand over stock"
                    : next === "COMPLETED" && o.fulfilmentMethod === "pickup"
                      ? "Confirm pickup and hand over stock"
                      : next.replaceAll("_", " ")}
                </button>
              )}
            </article>
          );
        })
      )}
      {op.uncertain && (
        <button
          className="button"
          disabled={op.busy}
          onClick={async () => {
            if (await op.submit("", {})) await load();
          }}
        >
          Retry the same update
        </button>
      )}
      {(error || op.message) && <p role="alert">{error || op.message}</p>}
    </>
  );
}
type Zone = {
  id: string;
  name: string;
  state: string;
  localGovernmentArea: string;
  areas: string[];
  feeKobo: number;
  active: boolean;
};
const blank = {
  name: "",
  state: "",
  localGovernmentArea: "",
  areas: "",
  fee: "",
  active: true,
};
export function DeliveryWorkspace() {
  const [zones, setZones] = useState<Zone[] | null>(null),
    [form, setForm] = useState({ ...blank, id: "" }),
    [error, setError] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch("/api/admin/delivery-zones", { cache: "no-store" });
    if (!r.ok) throw Error("Delivery settings could not load.");
    setZones(await r.json());
  }
  useEffect(() => {
    void fetch("/api/admin/delivery-zones", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Delivery settings could not load.");
        return r.json();
      })
      .then(setZones)
      .catch((e) => setError(e.message));
  }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const saved = await op.submit("/api/admin/delivery-zones", {
        ...(form.id ? { id: form.id } : {}),
        name: form.name,
        state: form.state,
        localGovernmentArea: form.localGovernmentArea,
        areas: form.areas
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        feeKobo: nairaToKobo(form.fee),
        active: form.active,
      });
      if (saved) {
        setForm({ ...blank, id: "" });
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner settings</p>
          <h1>Delivery areas</h1>
          <p>
            Only configured matches are accepted. No delivery fees are guessed.
            Latest 100 areas.
          </p>
        </div>
      </div>
      <form className="workspace-form" onSubmit={save}>
        <h2>{form.id ? "Edit delivery area" : "Add delivery area"}</h2>
        <fieldset disabled={op.busy || op.uncertain}>
          <div className="form-grid">
            {(["name", "state", "localGovernmentArea", "fee"] as const).map(
              (f) => (
                <label key={f}>
                  {f === "localGovernmentArea"
                    ? "Local government area"
                    : f === "fee"
                      ? "Fee (NGN)"
                      : f}
                  <input
                    required
                    value={form[f]}
                    maxLength={f === "state" ? 80 : 100}
                    onChange={(e) => setForm({ ...form, [f]: e.target.value })}
                  />
                </label>
              ),
            )}
          </div>
          <label>
            Neighbourhoods (one per line)
            <textarea
              required
              value={form.areas}
              onChange={(e) => setForm({ ...form, areas: e.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Active
          </label>
        </fieldset>
        <button className="button" disabled={op.busy}>
          {op.uncertain ? "Retry the same save" : "Save area"}
        </button>
      </form>
      {zones?.map((z) => (
        <article className="workspace-form" key={z.id}>
          <h2>{z.name}</h2>
          <p>
            {z.state} · {z.localGovernmentArea} · {formatNaira(z.feeKobo)} ·{" "}
            {z.active ? "Active" : "Inactive"}
          </p>
          <p>{z.areas.join(", ")}</p>
          <button
            className="text-link"
            disabled={op.busy || op.uncertain}
            onClick={() =>
              setForm({
                ...z,
                areas: z.areas.join("\n"),
                fee: String(z.feeKobo / 100),
              })
            }
          >
            Edit
          </button>
        </article>
      ))}
      {zones?.length === 0 && (
        <p>No delivery areas configured. Checkout offers pickup.</p>
      )}
      {(error || op.message) && <p role="alert">{error || op.message}</p>}
    </>
  );
}
