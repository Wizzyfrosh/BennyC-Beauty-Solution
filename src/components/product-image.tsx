import Image from "next/image";
import { Package } from "lucide-react";
import type { PublicProduct } from "@/features/catalog/types";
export function ProductImage({
  image,
  className = "",
}: {
  image: PublicProduct["image"];
  className?: string;
}) {
  if (!image)
    return (
      <div
        className={`product-image placeholder ${className}`}
        role="img"
        aria-label="Product photograph coming soon"
      >
        <Package size={38} strokeWidth={1} />
        <span>Image coming soon</span>
      </div>
    );
  if (image.tile !== null)
    return (
      <div
        role="img"
        aria-label={image.alt}
        className={`product-image product-sprite ${className}`}
        style={{
          backgroundImage: `url("${image.url}")`,
          backgroundPosition: `${(image.tile % 3) * 50}% ${Math.floor(image.tile / 3) * 100}%`,
        }}
      />
    );
  return (
    <div className={`product-image ${className}`}>
      <Image
        src={image.url}
        alt={image.alt}
        fill
        sizes="(max-width: 600px) 50vw, 25vw"
        style={{ objectFit: "cover" }}
      />
    </div>
  );
}
