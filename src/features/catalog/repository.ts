import "server-only";
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
      { isolationLevel: "RepeatableRead" },
    );
    return {
      products: rows.map(projectProduct),
      categories,
      brands: brands.map((b) => b.brand),
      total,
      unavailable: false,
    };
  } catch {
    console.error("Catalogue dependency unavailable");
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
    return { product: row ? projectProduct(row) : null, unavailable: false };
  } catch {
    console.error("Product dependency unavailable");
    return { product: null, unavailable: true };
  }
}
