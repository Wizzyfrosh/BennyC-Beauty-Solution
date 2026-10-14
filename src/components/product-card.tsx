import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatNaira } from "@/lib/money";
import type { PublicProduct } from "@/features/catalog/types";
import { ProductImage } from "./product-image";
export function ProductCard({
  product,
  preview = false,
}: {
  product: PublicProduct;
  preview?: boolean;
}) {
  const prices = product.variants.map((v) => v.priceKobo);
  const min = Math.min(...prices);
  const varies = new Set(prices).size > 1;
  const href = preview
    ? `/preview/${product.slug}`
    : `/products/${product.slug}`;
  return (
    <article className="product-card" data-motion>
      <Link
        href={href}
        className="product-photo-link"
        aria-label={`View ${product.name}`}
      >
        <ProductImage image={product.image} />
        {product.isDemo && <span className="product-badge">Sample</span>}
      </Link>
      <div className="product-card-copy">
        <p className="product-category">{product.category.name}</p>
        <Link href={href}>
          <h3>{product.name}</h3>
        </Link>
        <p className="variant-note">
          {product.variants.length}{" "}
          {product.variants.length === 1 ? "option" : "options"}
        </p>
        <p className="product-price">
          {varies && <span>From </span>}
          {formatNaira(min)}
        </p>
        <Link href={href} className="small-button">
          View product <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  );
}
