import type { Prisma } from "@/generated/prisma/client";
import type { CatalogueQuery } from "./validation";
export function publicProductWhere(
  query?: CatalogueQuery,
): Prisma.ProductWhereInput {
  return {
    status: "PUBLISHED",
    category: {
      active: true,
      ...(query?.category ? { slug: query.category } : {}),
    },
    variants: { some: { active: true } },
    ...(query?.brand ? { brand: query.brand } : {}),
    ...(query?.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
export const publicProductSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  description: true,
  isDemo: true,
  category: { select: { slug: true, name: true } },
  variants: {
    where: { active: true },
    orderBy: { priceKobo: "asc" },
    select: { id: true, sku: true, optionValues: true, priceKobo: true },
  },
  images: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    where: { variantId: null },
    select: { secureUrl: true, altText: true, demoTile: true },
  },
} satisfies Prisma.ProductSelect;
export type SelectedProduct = Prisma.ProductGetPayload<{
  select: typeof publicProductSelect;
}>;
export function projectProduct(row: SelectedProduct) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    description: row.description,
    isDemo: row.isDemo,
    category: row.category,
    image: row.images[0]
      ? {
          url: row.images[0].secureUrl,
          alt: row.images[0].altText,
          tile: row.images[0].demoTile,
        }
      : null,
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      priceKobo: v.priceKobo,
      label:
        typeof v.optionValues === "object" && v.optionValues !== null
          ? Object.values(v.optionValues).map(String).join(" · ")
          : "Standard",
    })),
  };
}
