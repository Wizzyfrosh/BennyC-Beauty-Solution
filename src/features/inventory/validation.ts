import { z } from "zod";
import { isDateLabel } from "./rules";
export const uuid = z.uuid();
export const receiptSchema = z
  .object({
    variantId: uuid,
    batchCode: z.string().trim().min(1).max(100),
    receiptReference: z.string().trim().min(1).max(100),
    quantity: z.number().int().min(1).max(100000),
    expiryPrecision: z.enum(["DAY", "MONTH", "NOT_APPLICABLE"]),
    expiryLabel: z.string().max(10).nullable().optional(),
    quarantine: z.boolean().default(false),
    unitCostKobo: z.number().int().min(0).max(2000000000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (
      v.expiryLabel &&
      ((v.expiryPrecision === "DAY" && !isDateLabel(v.expiryLabel)) ||
        (v.expiryPrecision === "MONTH" &&
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(v.expiryLabel)) ||
        v.expiryPrecision === "NOT_APPLICABLE")
    )
      ctx.addIssue({
        code: "custom",
        path: ["expiryLabel"],
        message: "Check the printed expiry label.",
      });
  });
export const adjustmentSchema = z
  .object({
    batchId: uuid,
    action: z.enum(["COUNT", "QUARANTINE", "RELEASE", "WRITE_OFF"]),
    quantity: z.number().int().min(0).max(100000),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
export const saleSchema = z
  .object({
    channel: z.enum(["WALK_IN", "WHATSAPP"]),
    items: z
      .array(
        z
          .object({
            variantId: uuid,
            quantity: z.number().int().min(1).max(10000),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    expectedTotalKobo: z.number().int().positive().max(2000000000),
    payment: z
      .object({
        method: z.enum(["CASH", "BANK_TRANSFER", "POS"]),
        confirmed: z.literal(true),
        reference: z.string().trim().max(100).optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((v, c) => {
    if (new Set(v.items.map((x) => x.variantId)).size !== v.items.length)
      c.addIssue({
        code: "custom",
        path: ["items"],
        message: "Combine duplicate options.",
      });
    if (v.payment.method !== "CASH" && !v.payment.reference)
      c.addIssue({
        code: "custom",
        path: ["payment", "reference"],
        message: "A confirmed payment reference is required.",
      });
  });
