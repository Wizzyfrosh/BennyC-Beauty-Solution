import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/server/db";
import { mutation, audit } from "@/server/mutations";
import type { StaffActor } from "@/server/admin-route";
import { DomainError } from "@/server/domain-error";
import { productInput } from "./admin-validation";
import { optionFingerprint } from "../inventory/rules";

export async function saveProduct(
  actor: StaffActor,
  id: string | null,
  key: string | null,
  raw: unknown,
) {
  const input = productInput.parse(raw);
  return mutation(
    actor,
    true,
    "catalogue.save",
    key,
    { id, ...input },
    async (tx, operationId) => {
      if (id) {
        await tx.$queryRaw`SELECT id FROM public.products WHERE id=${id}::uuid FOR UPDATE`;
        if (!(await tx.product.findUnique({ where: { id } })))
          throw new DomainError(404, "NOT_FOUND", "Product not found.");
      }
      const category = await tx.category.findUnique({
        where: { id: input.categoryId },
      });
      if (!category?.active && input.status === "PUBLISHED")
        throw new DomainError(
          409,
          "CATEGORY_INACTIVE",
          "Choose an active category before publishing.",
        );
      const { variants, ...fields } = input;
      const demo =
        (
          await tx.storeSettings.findUnique({
            where: { id: 1 },
            select: { demoData: true },
          })
        )?.demoData ?? false;
      const product = id
        ? await tx.product.update({ where: { id }, data: fields })
        : await tx.product.create({ data: { ...fields, isDemo: demo } });
      const fingerprints = variants.map((v) =>
        optionFingerprint(v.optionValues),
      );
      if (new Set(fingerprints).size !== fingerprints.length)
        throw new DomainError(
          409,
          "DUPLICATE_OPTION",
          "Each size or shade combination must be unique.",
        );
      const previous = await tx.productVariant.findMany({
        where: { productId: product.id },
        orderBy: { id: "asc" },
      });
      if (previous.length)
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM public.product_variants WHERE product_id=${product.id}::uuid ORDER BY id FOR UPDATE`,
        );
      for (const [index, v] of variants.entries()) {
        const { id: variantId, ...data } = v;
        if (variantId) {
          const old = previous.find((p) => p.id === variantId);
          if (!old)
            throw new DomainError(
              400,
              "INVALID_OPTION",
              "An option does not belong to this product.",
            );
          if (
            old.optionFingerprint !== fingerprints[index] &&
            ((await tx.stockBatch.count({ where: { variantId } })) ||
              (await tx.orderItem.count({ where: { variantId } })))
          )
            throw new DomainError(
              409,
              "OPTION_HAS_HISTORY",
              "Create a new option to change a size or shade after stock or sales have been recorded.",
            );
          await tx.productVariant.update({
            where: { id: variantId },
            data: { ...data, optionFingerprint: fingerprints[index] },
          });
        } else
          await tx.productVariant.create({
            data: {
              ...data,
              productId: product.id,
              optionFingerprint: fingerprints[index],
            },
          });
      }
      const kept = variants.flatMap((v) => (v.id ? [v.id] : []));
      const omitted = previous.filter((v) => !kept.includes(v.id));
      if (omitted.length)
        await tx.productVariant.updateMany({
          where: { id: { in: omitted.map((v) => v.id) } },
          data: { active: false },
        });
      await audit(
        tx,
        actor,
        operationId,
        id ? "product.updated" : "product.created",
        "product",
        product.id,
        { status: product.status, variantCount: variants.length },
      );
      return { id: product.id, slug: product.slug, status: product.status };
    },
  );
}
export async function listAdminProducts() {
  const [products, categories] = await getDb().$transaction([
    getDb().product.findMany({
      take: 100,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        brand: true,
        description: true,
        categoryId: true,
        status: true,
        expiryRequired: true,
        isDemo: true,
        variants: {
          orderBy: { sku: "asc" },
          select: {
            id: true,
            sku: true,
            optionValues: true,
            priceKobo: true,
            lowStockThreshold: true,
            active: true,
          },
        },
        images: {
          select: { id: true, secureUrl: true, altText: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    }),
    getDb().category.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);
  return { products, categories, limit: 100 };
}
