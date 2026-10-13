import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductDetail } from "@/components/product-detail";
import { getProduct } from "@/features/catalog/repository";
import { slugSchema } from "@/features/catalog/validation";
export const dynamic = "force-dynamic";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  const { product, unavailable } = await getProduct(slug);
  if (unavailable)
    return (
      <div className="container page-section empty-state">
        <h1>Product details are temporarily unavailable</h1>
        <p>Please try again shortly.</p>
        <Link className="button" href="/shop">
          Back to collection
        </Link>
      </div>
    );
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
