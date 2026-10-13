import { z } from "zod";
export const catalogueQuery = z.object({
  q: z.string().trim().max(100).default(""),
  category: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]*$/)
    .default(""),
  brand: z.string().trim().max(80).default(""),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const slugSchema = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const PAGE_SIZE = 12;
export type CatalogueQuery = z.infer<typeof catalogueQuery>;
