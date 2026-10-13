import { catalogueQuery } from "@/features/catalog/validation";
import { getCatalogue } from "@/features/catalog/repository";
import { apiError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = catalogueQuery.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!query.success)
    return apiError(400, "INVALID_QUERY", "Please check your search filters.");
  const result = await getCatalogue(query.data);
  if (result.unavailable)
    return apiError(
      503,
      "CATALOGUE_UNAVAILABLE",
      "The collection is temporarily unavailable.",
      true,
    );
  return Response.json(
    {
      products: result.products,
      total: result.total,
      page: query.data.page,
      categories: result.categories,
      brands: result.brands,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
