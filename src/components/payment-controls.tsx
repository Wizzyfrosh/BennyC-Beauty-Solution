"use client";
import { useState } from "react";
import { useOperation } from "./admin/request";
export function PaymentControls({
  id,
  pending,
}: {
  id: string;
  pending: boolean;
}) {
  const op = useOperation(),
    [message, setMessage] = useState(""),
    [action, setAction] = useState<"initialize" | "verify">("initialize");
  async function run(next: "initialize" | "verify") {
    setAction(next);
    setMessage("");
    const result = await op.submit(`/api/orders/${id}/payments/${next}`, {});
    if (!result) return;
    if (next === "initialize") {
      if (result.authorizationUrl) location.assign(result.authorizationUrl);
      else
        setMessage(
          "Test checkout could not open. Verify the existing payment before trying again.",
        );
    } else {
      setMessage(
        result.outcome === "confirmed" || result.outcome === "already_processed"
          ? "Payment confirmed. Refresh to see your order."
          : result.outcome === "paid_exception"
            ? "Payment recorded. Staff must review this order before fulfilment."
            : "Payment is still being checked. Do not pay again; retry verification.",
      );
    }
  }
  return (
    <div className="workspace-form">
      <h2>Paystack test payment</h2>
      <p>
        This uses the provider test environment. No live payment is enabled.
      </p>
      <button
        className="button"
        disabled={op.busy || op.uncertain || pending}
        onClick={() => run("initialize")}
      >
        Open test checkout
      </button>
      <button
        className="text-link"
        disabled={op.busy || op.uncertain}
        onClick={() => run("verify")}
      >
        Verify existing test payment
      </button>
      {op.uncertain && (
        <button
          className="button"
          disabled={op.busy}
          onClick={() => run(action)}
        >
          Retry the same payment action
        </button>
      )}
      {(op.message || message) && <p role="status">{op.message || message}</p>}
    </div>
  );
}
