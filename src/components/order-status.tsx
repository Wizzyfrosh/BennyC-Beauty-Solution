"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatNaira } from "@/lib/money";
import { useOperation } from "./admin/request";
export type OrderView = {
  id: string;
  orderNumber: string;
  totalKobo: number;
  deliveryFeeKobo: number;
  paymentStatus: string;
  fulfilmentStatus: string;
  fulfilmentMethod: string;
  isDemo: boolean;
  holdExpiresAt: string | null;
  serverTime?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  addressSnapshot?: {
    street: string;
    state: string;
    localGovernmentArea: string;
    area: string;
  };
  items: {
    productNameSnapshot: string;
    skuSnapshot: string;
    quantity: number;
    lineTotalKobo: number;
  }[];
};
export function OrderStatus({ id, enabled }: { id: string; enabled: boolean }) {
  const [order, setOrder] = useState<OrderView | null>(null),
    [error, setError] = useState(""),
    [link, setLink] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch(`/api/orders/${id}`, { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw Error(d.error?.message ?? "Order unavailable.");
    setOrder(d);
  }
  useEffect(() => {
    void fetch(`/api/orders/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error?.message ?? "Order unavailable.");
        return d;
      })
      .then(setOrder)
      .catch((e) => setError(e.message));
    const timer = setInterval(() => {
      void load().catch(() => {});
    }, 30000);
    return () => clearInterval(timer);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(path: string, body: unknown) {
    if (await op.submit(`/api/orders/${id}/${path}`, body))
      await load().catch(() =>
        setError("The action completed. Refresh to see current status."),
      );
  }
  if (!order)
    return (
      <section className="container page-section">
        <h1>Order status</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your private order…"}
        </p>
      </section>
    );
  const unpaid =
    ["UNPAID", "FAILED"].includes(order.paymentStatus) &&
    order.fulfilmentStatus !== "CANCELLED";
  return (
    <section className="container page-section checkout-shell">
      <p className="eyebrow">Your private order</p>
      <h1>{order.orderNumber}</h1>
      {order.isDemo && (
        <p className="notice">
          Demonstration order · Payment simulation does not transfer money.
        </p>
      )}
      <div className="workspace-form">
        <p>
          Payment: <strong>{order.paymentStatus}</strong>
        </p>
        <p>
          Fulfilment:{" "}
          <strong>{order.fulfilmentStatus.replaceAll("_", " ")}</strong> ·{" "}
          {order.fulfilmentMethod}
        </p>
        {order.items.map((l, i) => (
          <p key={i}>
            {l.quantity} × {l.productNameSnapshot} · {l.skuSnapshot}{" "}
            <strong>{formatNaira(l.lineTotalKobo)}</strong>
          </p>
        ))}
        <p>Delivery {formatNaira(order.deliveryFeeKobo)}</p>
        <p className="detail-price">Total {formatNaira(order.totalKobo)}</p>
        {unpaid && (
          <p>
            Reservation expires{" "}
            {order.holdExpiresAt
              ? new Date(order.holdExpiresAt).toLocaleString("en-NG", {
                  timeZone: "Africa/Lagos",
                })
              : "—"}{" "}
            (Lagos). Expired holds cannot be paid in this demo.
          </p>
        )}
      </div>
      {enabled && order.isDemo && unpaid && (
        <div className="workspace-form">
          <h2>Try a demo payment</h2>
          <fieldset disabled={op.busy || op.uncertain}>
            <button
              className="button"
              onClick={() => act("simulate-payment", { outcome: "success" })}
            >
              Simulate success
            </button>
            <button
              className="text-link"
              onClick={() => act("simulate-payment", { outcome: "failure" })}
            >
              Simulate failure
            </button>
            <button
              className="text-link"
              onClick={() =>
                act("cancel", { reason: "Customer cancelled demo order" })
              }
            >
              Cancel unpaid order
            </button>
          </fieldset>
        </div>
      )}
      {op.uncertain && (
        <button
          className="button"
          disabled={op.busy}
          onClick={() => act("simulate-payment", {})}
        >
          Retry the same operation
        </button>
      )}
      {unpaid && order.paymentStatus === "FAILED" && (
        <p>
          A failed simulation leaves the hold active until expiry, so you can
          retry safely.
        </p>
      )}
      <button
        className="text-link"
        onClick={async () => {
          try {
            const r = await fetch(`/api/orders/${id}/access-link`, {
              method: "POST",
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.error?.message);
            setLink(location.origin + d.path);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Link unavailable.");
          }
        }}
      >
        Create a private access link
      </button>
      {link && (
        <p className="notice">
          Keep this single-use link private. It expires in 24 hours.
          <br />
          <a href={link}>{link}</a>
        </p>
      )}
      {(error || op.message) && <p role="alert">{error || op.message}</p>}
      <p>
        <Link href="/shop">Continue browsing</Link>
      </p>
    </section>
  );
}
export function AccessExchange() {
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const token = location.hash.slice(1);
    history.replaceState(null, "", location.pathname);
    if (!token) {
      queueMicrotask(() =>
        setError("Open the complete private link supplied for your order."),
      );
      return;
    }
    void fetch("/api/order-access/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error?.message);
        router.replace(`/orders/${d.orderId}`);
      })
      .catch((e) => setError(e.message ?? "This link is unavailable."));
  }, [router]);
  return (
    <section className="container page-section">
      <h1>Private order access</h1>
      <p role={error ? "alert" : "status"}>{error || "Opening your order…"}</p>
    </section>
  );
}
