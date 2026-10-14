export type PublicVariant = {
  id: string;
  label: string;
  sku: string;
  priceKobo: number;
  availableQty?: number;
};
export type PublicProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  category: { slug: string; name: string };
  isDemo: boolean;
  image: { url: string; alt: string; tile: number | null } | null;
  variants: PublicVariant[];
};
export type Category = { slug: string; name: string };
