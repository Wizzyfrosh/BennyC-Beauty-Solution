import "server-only";
import { publicAvailability } from "../inventory/read-service";
import { getDb } from "@/server/db";
import { isServerConfigured } from "@/server/env";
import {
  publicProductWhere,
  publicProductSelect,
  projectProduct,
} from "./query";
import { PAGE_SIZE, type CatalogueQuery } from "./validation";
import type { PublicProduct, Category } from "./types";
export type CatalogueResult = {
  products: PublicProduct[];
  categories: Category[];
  brands: string[];
  total: number;
  unavailable: boolean;
};
const unavailable: CatalogueResult = {
  products: [],
  categories: [],
  brands: [],
  total: 0,
  unavailable: true,
};
export async function getCatalogue(
  query: CatalogueQuery,
): Promise<CatalogueResult> {
  if (!isServerConfigured()) return unavailable;
  try {
    const db = getDb();
    const where = publicProductWhere(query);
    const [rows, total, categories, brands] = await db.$transaction(
      [
        db.product.findMany({
          where,
          select: publicProductSelect,
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: PAGE_SIZE,
          skip: (query.page - 1) * PAGE_SIZE,
        }),
        db.product.count({ where }),
        db.category.findMany({
          where: { active: true, products: { some: publicProductWhere() } },
          select: { slug: true, name: true },
          orderBy: { sortOrder: "asc" },
        }),
        db.product.findMany({
          where: publicProductWhere(),
          select: { brand: true },
          distinct: ["brand"],
          orderBy: { brand: "asc" },
        }),
      ],
      { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 30000 },
    );
    const availability = await publicAvailability(
      rows.flatMap((row) => row.variants.map((v) => v.id)),
    );
    return {
      products: rows.map((row) => {
        const p = projectProduct(row);
        return {
          ...p,
          variants: p.variants.map((v) => ({
            ...v,
            availableQty: availability.get(v.id) ?? 0,
          })),
        };
      }),
      categories,
      brands: brands.map((b) => b.brand),
      total,
      unavailable: false,
    };
  } catch (err) {
    console.error("Catalogue dependency unavailable:", (err as Error).message);
    return unavailable;
  }
}
export async function getProduct(
  slug: string,
): Promise<{ product: PublicProduct | null; unavailable: boolean }> {
  if (!isServerConfigured()) return { product: null, unavailable: true };
  try {
    const row = await getDb().product.findFirst({
      where: { ...publicProductWhere(), slug },
      select: publicProductSelect,
    });
    if (!row) return { product: null, unavailable: false };
    const availability = await publicAvailability(
      row.variants.map((v) => v.id),
    );
    const product = projectProduct(row);
    return {
      product: {
        ...product,
        variants: product.variants.map((v) => ({
          ...v,
          availableQty: availability.get(v.id) ?? 0,
        })),
      },
      unavailable: false,
    };
  } catch {
    console.error("Product dependency unavailable");
    return { product: null, unavailable: true };
  }
}
