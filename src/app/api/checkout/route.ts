import { customerRoute } from "@/server/customer-route";
import { readJson } from "@/server/admin-route";
import { guestSession, issueOrderAccess } from "@/features/orders/access";
import { z } from "zod";
import { checkout, checkoutFromIntent } from "@/features/orders/service";
export async function POST(req: Request) {
  return customerRoute(req, true, async () => {
    const s = await guestSession();
    const body = await readJson(req);
    const intent = z.strictObject({ intentId: z.uuid() }).safeParse(body);
    const result = intent.success
      ? await checkoutFromIntent(s.id, intent.data.intentId)
      : await checkout(s.id, req.headers.get("idempotency-key"), body);
    await issueOrderAccess(result.orderId, s.id);
    return result;
  });
}
