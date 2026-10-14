import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { demoProducts } from "@/features/catalog/demo-data";
export const metadata = {
  title: "Sample product",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = demoProducts.find((p) => p.slug === slug);
  if (!product) notFound();
  return (
    <>
      <div className="demo-notice">
        Design preview · Sample product · Not for sale
      </div>
      <ProductDetail product={product} preview />
    </>
  );
}
