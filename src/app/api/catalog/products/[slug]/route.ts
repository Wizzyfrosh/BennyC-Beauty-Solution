import { getProduct } from "@/features/catalog/repository";
import { slugSchema } from "@/features/catalog/validation";
import { apiError } from "@/server/http";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success)
    return apiError(404, "NOT_FOUND", "Product not found.");
  const result = await getProduct(slug);
  if (result.unavailable)
    return apiError(
      503,
      "CATALOGUE_UNAVAILABLE",
      "Product details are temporarily unavailable.",
      true,
    );
  if (!result.product) return apiError(404, "NOT_FOUND", "Product not found.");
  return Response.json(result.product, {
    headers: { "Cache-Control": "no-store" },
  });
}
