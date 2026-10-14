import { z } from "zod";
import { customerRoute } from "@/server/customer-route";
import { boundedBody } from "@/server/admin-route";
import { DomainError } from "@/server/domain-error";
import { digest } from "@/server/mutations";
import { providerConfig } from "@/features/payments/provider";
import { validSignature } from "@/features/payments/rules";
import { confirmRefundEvent } from "@/features/payments/refund-events";
import { webhook } from "@/features/payments/service";
export async function POST(req: Request) {
  return customerRoute(req, false, async () => {
    const bytes = await boundedBody(req, 262144),
      { key } = providerConfig();
    if (!validSignature(bytes, req.headers.get("x-paystack-signature"), key))
      throw new DomainError(
        401,
        "INVALID_SIGNATURE",
        "This webhook signature is invalid.",
      );
    let raw: unknown;
    try {
      raw = JSON.parse(bytes.toString("utf8"));
    } catch {
      throw new DomainError(400, "INVALID_JSON", "Invalid event.");
    }
    const event = z
      .object({ event: z.string().max(80), data: z.unknown() })
      .parse(raw);
    if (event.event.startsWith("refund.")) {
      const refund = z
        .object({
          id: z.union([
            z.number().int().safe().nonnegative(),
            z.string().regex(/^\d{1,20}$/),
          ]),
        })
        .parse(event.data);
      return confirmRefundEvent(String(refund.id));
    }
    if (event.event !== "charge.success")
      return { outcome: "unsupported_event" };
    const data = z
      .object({ reference: z.string().min(1).max(150) })
      .parse(event.data);
    return webhook(data.reference, digest(bytes.toString("utf8")));
  });
}
