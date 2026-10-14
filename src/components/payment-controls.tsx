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
    [message, setMessage] = useState("");
  return (
    <div className="workspace-form">
      <h2>Paystack test payment</h2>
      <p>
        This uses the provider test environment. No live payment is enabled.
      </p>
      <button
        className="button"
        disabled={op.busy || pending}
        onClick={async () => {
          const result = await op.submit(
            `/api/orders/${id}/payments/initialize`,
            {},
          );
          if (result?.authorizationUrl)
            location.assign(result.authorizationUrl);
        }}
      >
        Open test checkout
      </button>
      <button
        className="text-link"
        disabled={op.busy}
        onClick={async () => {
          const result = await op.submit(
            `/api/orders/${id}/payments/verify`,
            {},
          );
          if (result)
            setMessage(
              result.outcome === "confirmed" ||
                result.outcome === "already_processed"
                ? "Payment confirmed. Refresh to see your order."
                : result.outcome === "paid_exception"
                  ? "Payment recorded. Staff must review this order before fulfilment."
                  : "Payment is still being checked. Do not pay again; retry verification.",
            );
        }}
      >
        Verify existing test payment
      </button>
      {(op.message || message) && <p role="status">{op.message || message}</p>}
    </div>
  );
}
