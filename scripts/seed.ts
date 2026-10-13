import "dotenv/config";
import { createPrismaClient } from "../src/server/prisma-client";
import { demoProducts } from "../src/features/catalog/demo-data";

async function main() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.BENNYC_DEMO_DATA !== "true"
  )
    throw new Error(
      "Demo seeding requires a non-production environment and BENNYC_DEMO_DATA=true.",
    );
  const url = process.env.DIRECT_URL;
  if (!url) throw new Error("DIRECT_URL is required for trusted seeding.");
  const expected = process.env.SEED_DATABASE_NAME;
  if (
    !expected ||
    decodeURIComponent(new URL(url).pathname.slice(1)) !== expected
  )
    throw new Error(
      "Confirm the dedicated development database name in SEED_DATABASE_NAME.",
    );
  const db = createPrismaClient(url);
  try {
    const actual = await db.$queryRaw<
      Array<{ name: string }>
    >`SELECT current_database() AS name`;
    if (actual[0]?.name !== expected)
      throw new Error(
        "Database name does not match the confirmed seed target.",
      );
    await db.$transaction(
      async (tx) => {
        if (await tx.product.count({ where: { isDemo: false } }))
          throw new Error(
            "Refusing to seed a database with non-demo products.",
          );
        await tx.storeSettings.upsert({
          where: { id: 1 },
          create: { id: 1, demoData: true },
          update: { demoData: true },
        });
        for (const [index, p] of demoProducts.entries()) {
          const category = await tx.category.upsert({
            where: { slug: p.category.slug },
            create: {
              slug: p.category.slug,
              name: p.category.name,
              sortOrder: index,
            },
            update: {},
          });
          const product = await tx.product.upsert({
            where: { slug: p.slug },
            create: {
              slug: p.slug,
              name: p.name,
              brand: p.brand,
              description: p.description,
              categoryId: category.id,
              isDemo: true,
              status: "PUBLISHED",
              expiryRequired: p.category.slug !== "accessories",
            },
            update: {},
          });
          for (const variant of p.variants) {
            const optionKey =
              p.category.slug === "makeup"
                ? "shade"
                : p.category.slug === "accessories"
                  ? "size"
                  : "volume";
            await tx.productVariant.upsert({
              where: { sku: variant.sku },
              create: {
                productId: product.id,
                sku: variant.sku,
                optionValues: { [optionKey]: variant.label },
                optionFingerprint: `${optionKey}:${variant.label.toLowerCase()}`,
                priceKobo: variant.priceKobo,
              },
              update: {},
            });
          }
          if (p.image)
            await tx.productImage.upsert({
              where: {
                provider_assetId: { provider: "LOCAL", assetId: p.slug },
              },
              create: {
                productId: product.id,
                provider: "LOCAL",
                assetId: p.slug,
                secureUrl: p.image.url,
                format: "png",
                width: 1536,
                height: 1024,
                altText: p.image.alt,
                demoTile: p.image.tile,
              },
              update: {},
            });
        }
        const category = await tx.category.findUniqueOrThrow({
          where: { slug: "serums" },
        });
        await tx.product.upsert({
          where: { slug: "demo-unpublished-serum" },
          create: {
            slug: "demo-unpublished-serum",
            name: "Unpublished Demo Serum",
            brand: "BennyC Demo Collection",
            description:
              "Private draft fixture; must never appear in public catalogue responses.",
            categoryId: category.id,
            status: "DRAFT",
            isDemo: true,
          },
          update: {},
        });
      },
      { timeout: 30000 },
    );
    console.log(
      "Development fixtures ready: 12 sample products and 1 unpublished draft. No stock or sales invented.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Seed failed. Check the dedicated database, seed confirmation and migration setup. No connection strings are logged.",
  );
  process.exitCode = 1;
});
