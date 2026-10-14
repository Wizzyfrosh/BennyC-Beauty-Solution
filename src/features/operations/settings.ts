import "server-only";
import { z } from "zod";
import { getDb } from "@/server/db";
import { mutation, audit } from "@/server/mutations";
import type { StaffActor } from "@/server/admin-route";
const text = (max: number) => z.string().trim().max(max).nullable();
export const settingsSchema = z.strictObject({
  phone: text(20).refine(
    (v) => !v || /^(?:\+234[789]\d{9}|0[789]\d{9})$/.test(v),
  ),
  email: z.union([z.email().max(254), z.literal(""), z.null()]),
  whatsapp: text(20).refine(
    (v) => !v || /^(?:\+234[789]\d{9}|0[789]\d{9})$/.test(v),
  ),
  pickupAddress: text(500),
  businessHours: text(250),
  privacyPolicy: text(10000),
  returnsPolicy: text(10000),
  deliveryPolicy: text(10000),
  reason: z.string().trim().min(3).max(500),
});
export async function storeSetup() {
  return getDb().storeSettings.findUniqueOrThrow({
    where: { id: 1 },
    select: {
      phone: true,
      email: true,
      whatsapp: true,
      pickupAddress: true,
      businessHours: true,
      privacyPolicy: true,
      returnsPolicy: true,
      deliveryPolicy: true,
      demoData: true,
    },
  });
}
export async function saveSettings(
  actor: StaffActor,
  key: string | null,
  raw: unknown,
) {
  const input = settingsSchema.parse(raw);
  return mutation(actor, true, "settings.save", key, input, async (tx, op) => {
    const { reason, ...fields } = input;
    const data = Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, v || null]),
    );
    await tx.storeSettings.update({ where: { id: 1 }, data });
    await audit(tx, actor, op, "store.settings-updated", "store", "1", {
      fields: Object.keys(data),
      reason,
    });
    return { saved: true };
  });
}
