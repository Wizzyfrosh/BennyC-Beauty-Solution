"use client";
import { useEffect, useState } from "react";
import { formatNaira } from "@/lib/money";
import { useOperation, nairaToKobo } from "./request";
type Attempt = {
  id: string;
  provider: string;
  paymentMode: string;
  providerReference: string | null;
  amountKobo: number;
  status: string;
  refunds: {
    id: string;
    amountKobo: number;
    status: string;
    providerReference: string | null;
  }[];
};
type FinancialOrder = {
  id: string;
  orderNumber: string;
  isDemo: boolean;
  paymentStatus: string;
  fulfilmentStatus: string;
  exceptionCode: string | null;
  items: {
    id: string;
    productNameSnapshot: string;
    quantity: number;
    movements: { batchId: string; onHandDelta: number }[];
  }[];
  paymentAttempts: Attempt[];
};
export function PaymentWorkspace() {
  const [orders, setOrders] = useState<FinancialOrder[] | null>(null),
    [error, setError] = useState("");
  const op = useOperation();
  async function load() {
    const r = await fetch("/api/admin/payments", { cache: "no-store" });
    if (!r.ok) throw Error("Financial records could not load.");
    setOrders(await r.json());
  }
  useEffect(() => {
    void fetch("/api/admin/payments", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error("Financial records could not load.");
        return r.json();
      })
      .then(setOrders)
      .catch((e) => setError(e.message));
  }, []);
  async function job(path: string) {
    if (await op.submit(`/api/admin/jobs/${path}`, {}))
      await load().catch((e) => setError(e.message));
  }
  return (
    <>
      <div className="workspace-title">
        <div>
          <p className="eyebrow">Owner financial controls</p>
          <h1>Payments & resolution</h1>
          <p>
            Latest 50 website orders. No live payments enabled. Refunds never
            restock physical units.
          </p>
        </div>
      </div>
      <div className="workspace-form">
        <button
          className="button"
          disabled={op.busy || op.uncertain}
          onClick={() => job("payments")}
        >
          Reconcile test payments/refunds
        </button>
        <button
          className="text-link"
          disabled={op.busy || op.uncertain}
          onClick={() => job("outbox")}
        >
          Publish queued private receipts
        </button>
        <p>Receipts are published in the app. No email or SMS is sent.</p>
      </div>
      {orders === null ? (
        <p role="status">{error || "Loading financial records…"}</p>
      ) : (
        orders.map((order) => (
          <FinancialCard key={order.id} order={order} refresh={load} />
        ))
      )}
      {op.uncertain && (
        <button className="button" onClick={() => job("payments")}>
          Retry same job
        </button>
      )}
      {(error || op.message) && <p role="alert">{error || op.message}</p>}
    </>
  );
}
function FinancialCard({
  order,
  refresh,
}: {
  order: FinancialOrder;
  refresh: () => Promise<void>;
}) {
  const op = useOperation(),
    [error, setError] = useState("");
  async function submit(path: string, body: unknown) {
    if (await op.submit(`/api/admin/orders/${order.id}/${path}`, body))
      await refresh().catch((e) => setError(e.message));
  }
  async function refund(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    try {
      const form = new FormData(e.currentTarget),
        paymentAttemptId = String(form.get("payment")),
        refundId = String(form.get("obligation"));
      await submit("refunds", {
        paymentAttemptId,
        ...(refundId ? { refundId } : {}),
        amountKobo: nairaToKobo(String(form.get("amount"))),
        reason: String(form.get("reason")),
        ...(form.get("providerId")
          ? { providerRefundReference: String(form.get("providerId")) }
          : {}),
        ...(form.get("simulate") ? { simulateSuccess: true } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record refund.");
    }
  }
  async function returned(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      [orderItemId, batchId] = String(form.get("line")).split(":");
    await submit("returns", {
      orderItemId,
      batchId,
      quantity: Number(form.get("quantity")),
      reason: String(form.get("reason")),
    });
  }
  const successful = order.paymentAttempts.filter(
    (a) => a.status === "SUCCEEDED",
  );
  return (
    <article className="workspace-form">
      <h2>{order.orderNumber}</h2>
      <p>
        {order.paymentStatus} · {order.fulfilmentStatus}
        {order.exceptionCode && ` · ${order.exceptionCode}`}
      </p>
      {order.isDemo && <span className="sample-label">Sample/test order</span>}
      {order.paymentAttempts.map((a) => (
        <div key={a.id}>
          <p>
            {a.provider} · {a.paymentMode} · {a.status} ·{" "}
            {formatNaira(a.amountKobo)}
            <br />
            {a.providerReference}
          </p>
          {a.refunds.map((r) => (
            <p key={r.id}>
              Refund obligation {r.id} · {formatNaira(r.amountKobo)} ·{" "}
              {r.status}
            </p>
          ))}
        </div>
      ))}
      {successful.length > 0 &&
        !["DISPATCHED", "COMPLETED", "CANCELLED"].includes(
          order.fulfilmentStatus,
        ) && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await submit("cancel-paid", {
                reason: String(new FormData(e.currentTarget).get("reason")),
              });
            }}
          >
            <fieldset disabled={op.busy || op.uncertain}>
              <label>
                Cancellation reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
              <button className="text-link">
                Cancel before handoff and record refund obligation
              </button>
            </fieldset>
          </form>
        )}
      {successful.length > 0 && (
        <form onSubmit={refund}>
          <h3>Record verified refund</h3>
          <p>
            For Paystack, initiate the refund in its test dashboard, then enter
            the refund ID. A pending provider refund is not a completed refund.
          </p>
          <fieldset disabled={op.busy || op.uncertain}>
            <div className="form-grid">
              <label>
                Captured payment
                <select name="payment">
                  {successful.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.provider} {a.id} · {formatNaira(a.amountKobo)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Existing obligation
                <select name="obligation">
                  <option value="">New partial refund</option>
                  {successful.flatMap((a) =>
                    a.refunds
                      .filter((r) => r.status !== "SUCCEEDED")
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.id} · {formatNaira(r.amountKobo)}
                        </option>
                      )),
                  )}
                </select>
              </label>
              <label>
                Amount (NGN)
                <input name="amount" required inputMode="decimal" />
              </label>
              <label>
                Paystack test refund ID
                <input name="providerId" pattern="[0-9]+" />
              </label>
              <label>
                Reason
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            </div>
            {order.isDemo && (
              <label>
                <input type="checkbox" name="simulate" /> Confirm simulated
                refund (simulated payments only)
              </label>
            )}
            <button className="button">Verify and record refund</button>
          </fieldset>
        </form>
      )}
      {["DISPATCHED", "COMPLETED"].includes(order.fulfilmentStatus) && (
        <form onSubmit={returned}>
          <h3>Receive a physical return into quarantine</h3>
          <fieldset disabled={op.busy || op.uncertain}>
            <label>
              Sold line and original batch
              <select name="line" required>
                {order.items.flatMap((i) =>
                  i.movements.map((m) => (
                    <option
                      key={`${i.id}:${m.batchId}`}
                      value={`${i.id}:${m.batchId}`}
                    >
                      {i.productNameSnapshot} · {m.batchId} · {-m.onHandDelta}{" "}
                      handed over
                    </option>
                  )),
                )}
              </select>
            </label>
            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min={1}
                max={10000}
                required
              />
            </label>
            <label>
              Return reason
              <input name="reason" required minLength={3} maxLength={500} />
            </label>
            <button className="button">Record quarantined return</button>
          </fieldset>
        </form>
      )}
      {op.uncertain && (
        <button
          className="button"
          disabled={op.busy}
          onClick={() => submit("refunds", {})}
        >
          Retry same operation
        </button>
      )}
      {(error || op.message) && <p role="alert">{error || op.message}</p>}
    </article>
  );
}
