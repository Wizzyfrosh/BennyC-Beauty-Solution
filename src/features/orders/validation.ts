import { z } from "zod";
export const basketSchema = z
  .array(
    z.strictObject({
      variantId: z.uuid(),
      quantity: z.number().int().min(1).max(10000),
    }),
  )
  .min(1)
  .max(20)
  .refine(
    (items) => new Set(items.map((x) => x.variantId)).size === items.length,
    "Duplicate options",
  );
const text = (max: number) => z.string().trim().min(2).max(max);
export const fulfilmentSchema = z.discriminatedUnion("method", [
  z.strictObject({ method: z.literal("pickup") }),
  z.strictObject({
    method: z.literal("delivery"),
    zoneId: z.uuid(),
    address: z.strictObject({
      street: text(200),
      state: text(80),
      localGovernmentArea: text(100),
      area: text(100),
    }),
  }),
]);
export const quoteSchema = z.strictObject({
  items: basketSchema,
  fulfilment: fulfilmentSchema,
});
export const checkoutSchema = quoteSchema.extend({
  quoteVersion: z.string().regex(/^[a-f0-9]{64}$/),
  contact: z.strictObject({
    name: text(120),
    email: z.email().max(254),
    phone: z.string().regex(/^(?:\+234[789]\d{9}|0[789]\d{9})$/),
  }),
});
export const zoneSchema = z.strictObject({
  id: z.uuid().optional(),
  name: text(100),
  state: text(80),
  localGovernmentArea: text(100),
  areas: z.array(text(100)).min(1).max(100),
  feeKobo: z.number().int().min(0).max(2000000000),
  active: z.boolean(),
});
export const transitionSchema = z.strictObject({
  target: z.enum(["PREPARING", "READY_FOR_PICKUP", "DISPATCHED", "COMPLETED"]),
});
export type QuoteInput = z.infer<typeof quoteSchema>;
export const normalized = (s: string) =>
  s.trim().toLocaleLowerCase("en-NG").replace(/\s+/g, " ");
