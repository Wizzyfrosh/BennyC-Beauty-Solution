import { Homepage } from "@/components/homepage";
import { getCatalogue } from "@/features/catalog/repository";
import { catalogueQuery } from "@/features/catalog/validation";
export const dynamic = "force-dynamic";
export default async function Home() {
  const result = await getCatalogue(catalogueQuery.parse({}));
  return (
    <Homepage
      products={result.products.slice(0, 4)}
      unavailable={result.unavailable}
    />
  );
}
