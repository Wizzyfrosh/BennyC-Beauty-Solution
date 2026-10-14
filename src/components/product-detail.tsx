import Link from "next/link";
import { ArrowLeft, Info, Leaf } from "lucide-react";
import type { PublicProduct } from "@/features/catalog/types";
import { ProductImage } from "./product-image";
import { VariantPicker } from "./variant-picker";
export function ProductDetail({
  product,
  preview = false,
}: {
  product: PublicProduct;
  preview?: boolean;
}) {
  const ordering =
    !preview &&
    product.isDemo &&
    process.env.NODE_ENV !== "production" &&
    process.env.BENNYC_DEMO_CHECKOUT === "true";
  return (
    <section className="container page-section">
      <Link
        className="text-link back-link"
        href={preview ? "/preview#featured" : "/shop"}
      >
        <ArrowLeft size={16} /> Back to collection
      </Link>
      <div className="product-detail">
        <div>
          <ProductImage image={product.image} className="detail-image" />
          {product.isDemo && (
            <p className="image-caption">Illustrative sample packaging</p>
          )}
        </div>
        <div className="detail-copy">
          <p className="eyebrow">{product.category.name}</p>
          <h1>{product.name}</h1>
          <p className="detail-brand">{product.brand}</p>
          {product.isDemo && (
            <span className="sample-label">
              Demonstration product · Not for sale
            </span>
          )}
          <VariantPicker
            variants={product.variants}
            name={product.name}
            ordering={ordering}
          />
          <p className="detail-description">{product.description}</p>
          <div className="notice">
            <Info size={20} />
            <p>
              {ordering
                ? "Sample checkout is enabled for this private demonstration. No real payment is taken."
                : "Online ordering is not open yet. Availability will be confirmed when shopping opens."}
            </p>
          </div>
          <details className="product-accordion">
            <summary>Product information</summary>
            <p>
              Confirmed ingredients, directions and product warnings will be
              added from the original packaging before this item is offered for
              sale.
            </p>
          </details>
          <details className="product-accordion">
            <summary>Pickup & delivery</summary>
            <p>
              Pickup details, delivery areas and charges are being confirmed.
            </p>
          </details>
          <Link className="text-link" href="/shopping-guide">
            <Leaf size={17} /> Read our shopping guide
          </Link>
        </div>
      </div>
    </section>
  );
}
