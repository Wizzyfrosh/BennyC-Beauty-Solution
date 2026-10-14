"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatNaira } from "@/lib/money";
import type { OrderView } from "./order-status";
export function ReceiptPage({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<OrderView | null>(null),
    [message, setMessage] = useState("Loading your private receipt…");
  useEffect(() => {
    void fetch(`/api/orders/${id}/receipt`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw Error(d.error?.message);
        if (d.ready) setReceipt(d.order);
        else setMessage(d.message);
      })
      .catch((e) => setMessage(e.message ?? "Receipt unavailable."));
  }, [id]);
  return (
    <section className="container page-section checkout-shell">
      <p className="eyebrow">BennyC Beauty Solution</p>
      <h1>Private receipt</h1>
      {receipt ? (
        <article className="workspace-form">
          <h2>{receipt.orderNumber}</h2>
          {receipt.isDemo && (
            <p className="notice">
              Sample order · Simulated or test payment · No live settlement
            </p>
          )}
          <p>
            Payment {receipt.paymentStatus} · {receipt.fulfilmentMethod}
          </p>
          {receipt.items.map((i, n) => (
            <p key={n}>
              {i.quantity} × {i.productNameSnapshot} · {i.skuSnapshot}{" "}
              <strong>{formatNaira(i.lineTotalKobo)}</strong>
            </p>
          ))}
          <p>Delivery {formatNaira(receipt.deliveryFeeKobo)}</p>
          <p className="detail-price">Total {formatNaira(receipt.totalKobo)}</p>
          <button className="text-link" onClick={() => window.print()}>
            Print receipt
          </button>
        </article>
      ) : (
        <p role="status">{message}</p>
      )}
      <Link href={`/orders/${id}`}>Back to private order</Link>
    </section>
  );
}
