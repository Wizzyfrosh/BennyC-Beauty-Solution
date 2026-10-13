import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Droplets,
  Flower2,
  Headphones,
  Leaf,
  Mail,
  Package,
  Palette,
  Sparkles,
} from "lucide-react";
import type { PublicProduct } from "@/features/catalog/types";
import { ProductCard } from "./product-card";
import { ProductImage } from "./product-image";

const categories = [
  ["serums", "Serums", 0],
  ["moisturizers", "Moisturizers", 1],
  ["cleansers", "Cleansers", 2],
  ["toners", "Toners", 3],
  ["eye-care", "Eye care", 4],
  ["sun-care", "Sun care", 5],
] as const;
const benefits = [
  { Icon: Leaf, title: "Skincare essentials", text: "Your daily ritual" },
  { Icon: Droplets, title: "Body & fragrance", text: "Find your favourite" },
  { Icon: Palette, title: "Makeup & colour", text: "Express yourself" },
  { Icon: Flower2, title: "Everyday beauty", text: "Discover something new" },
];
export function Homepage({
  products,
  preview = false,
  unavailable = false,
}: {
  products: PublicProduct[];
  preview?: boolean;
  unavailable?: boolean;
}) {
  return (
    <>
      {preview && (
        <div className="demo-notice" role="note">
          Design preview · Fictional products and sample prices · No orders or
          payments
        </div>
      )}
      <section className="hero" aria-labelledby="hero-title">
        <Image
          src="/images/beauty-hero.png"
          alt="Botanical skincare portrait with teal water and leaves"
          fill
          priority
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-shade" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <p className="eyebrow">Beautifully you, every day</p>
            <h1 id="hero-title">
              Skincare
              <br />
              that cares,
              <br />
              beauty that
              <br />
              shines.
            </h1>
            <div className="botanical-rule">
              <span />
              <Leaf size={17} />
              <span />
            </div>
            <p className="hero-description">
              Discover beauty essentials for your
              <br className="desktop-break" /> skin, your style, and your
              everyday ritual.
            </p>
            <div className="hero-actions">
              <Link href={preview ? "#featured" : "/shop"} className="button">
                Explore the shop <ArrowRight size={18} />
              </Link>
              <Link href="/about" className="hero-secondary">
                <span>↗</span> Our story
              </Link>
            </div>
          </div>
        </div>
      </section>
      <div className="container">
        <section className="benefits-panel" aria-label="Explore BennyC">
          {benefits.map(({ Icon, title, text }) => (
            <div className="benefit" key={title}>
              <Icon size={41} strokeWidth={1} />
              <div>
                <h2>{title}</h2>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </section>
        <section className="categories-section" id="categories">
          <div className="ornament-heading">
            <span>◇</span>
            <h2>Shop by category</h2>
            <span>◇</span>
          </div>
          <div className="category-grid">
            {categories.map(([slug, name, tile]) => (
              <Link
                href={
                  preview
                    ? `/preview?category=${slug}#featured`
                    : `/shop?category=${slug}`
                }
                className="category-item"
                key={slug}
              >
                <ProductImage
                  image={{
                    url: "/images/demo-products.png",
                    alt: `Illustrative ${name.toLowerCase()} packaging`,
                    tile,
                  }}
                />
                <h3>{name}</h3>
                <span>
                  Explore <ArrowRight size={11} />
                </span>
              </Link>
            ))}
          </div>
        </section>
        <section className="featured-section" id="featured">
          <div className="section-heading">
            <h2>{preview ? "The preview collection" : "Featured products"}</h2>
            <span className="heading-rule">◇</span>
            <Link
              className="outline-button"
              href={preview ? "/preview?all=1#featured" : "/shop"}
            >
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {products.some((p) => p.isDemo) && !preview && (
            <p className="catalogue-note">
              Sample collection · Demonstration products and prices, not for
              sale.
            </p>
          )}
          {products.length ? (
            <div className="product-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} preview={preview} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Leaf size={32} strokeWidth={1} />
              <h3>
                {unavailable
                  ? "Our collection is being prepared"
                  : "A fresh collection is on its way"}
              </h3>
              <p>
                Please check back soon to explore BennyC’s beauty essentials.
              </p>
              <Link href="/shop" className="text-link">
                Explore the catalogue <ArrowRight size={16} />
              </Link>
            </div>
          )}
        </section>
        <section className="ritual-banner" aria-labelledby="ritual-title">
          <Image
            src="/images/beauty-ritual.png"
            alt="Illustrative skincare bottles on a botanical stone display"
            fill
            sizes="(max-width: 1280px) 90vw, 1200px"
          />
          <div className="ritual-copy">
            <p className="eyebrow">A moment for yourself</p>
            <h2 id="ritual-title">
              Your beauty.
              <br />
              Your daily ritual.
            </h2>
            <p>
              Find the little essentials that
              <br />
              make every day feel like you.
            </p>
          </div>
          <Link className="ritual-cta" href="/shop">
            <Mail size={37} strokeWidth={1} />
            <strong>Discover BennyC</strong>
            <span>
              Explore skincare, fragrance
              <br />
              and makeup essentials.
            </span>
            <ArrowRight size={19} />
          </Link>
        </section>
        <section className="service-panel" aria-label="Store information">
          <div>
            <Package />
            <p>
              <strong>Explore the range</strong>
              <span>Skincare, makeup & fragrance</span>
            </p>
          </div>
          <div>
            <Sparkles />
            <p>
              <strong>Choose your essentials</strong>
              <span>Compare sizes & options</span>
            </p>
          </div>
          <div>
            <Leaf />
            <p>
              <strong>Made for your routine</strong>
              <span>Discover the collection</span>
            </p>
          </div>
          <Link href="/shopping-guide">
            <Headphones />
            <p>
              <strong>Shopping information</strong>
              <span>Read before you order</span>
            </p>
          </Link>
        </section>
      </div>
    </>
  );
}
