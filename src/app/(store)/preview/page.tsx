import { Homepage } from "@/components/homepage";
import { demoProducts } from "@/features/catalog/demo-data";
export const metadata = {
  title: "Design preview",
  robots: { index: false, follow: false },
};
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; all?: string }>;
}) {
  const params = await searchParams;
  const rows = params.category
    ? demoProducts.filter((p) => p.category.slug === params.category)
    : params.all
      ? demoProducts
      : demoProducts.slice(0, 4);
  return <Homepage products={rows} preview />;
}
