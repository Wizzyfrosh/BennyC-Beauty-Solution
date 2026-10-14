import { z } from "zod";
export const variantInput = z
  .object({
    id: z.uuid().optional(),
    sku: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[A-Za-z0-9._-]+$/)
      .transform((s) => s.toUpperCase()),
    optionValues: z
      .record(
        z.string().trim().min(1).max(30),
        z.string().trim().min(1).max(60),
      )
      .refine((v) => Object.keys(v).length <= 4),
    priceKobo: z.number().int().positive().max(2000000000),
    lowStockThreshold: z.number().int().min(0).max(100000).default(0),
    active: z.boolean().default(true),
  })
  .strict();
export const productInput = z
  .object({
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    brand: z.string().trim().min(1).max(80),
    description: z.string().trim().min(10).max(5000),
    categoryId: z.uuid(),
    expiryRequired: z.boolean(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    variants: z.array(variantInput).min(1).max(40),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.status === "PUBLISHED" && !v.variants.some((x) => x.active))
      c.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Published products need an active option.",
      });
    if (new Set(v.variants.map((x) => x.sku)).size !== v.variants.length)
      c.addIssue({
        code: "custom",
        path: ["variants"],
        message: "SKUs must be unique.",
      });
  });
