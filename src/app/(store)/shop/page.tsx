import Link from "next/link";
import { Search, ArrowRight, Leaf } from "lucide-react";
import { catalogueQuery, PAGE_SIZE } from "@/features/catalog/validation";
import { getCatalogue } from "@/features/catalog/repository";
import { ProductCard } from "@/components/product-card";
export const metadata = { title: "Shop the collection" };
export const dynamic = "force-dynamic";
export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = catalogueQuery.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <div className="container page-section empty-state">
        <h1>Please check your search</h1>
        <p>Use a shorter search or clear your filters.</p>
        <Link href="/shop" className="button">
          Clear filters
        </Link>
      </div>
    );
  const query = parsed.data;
  const result = await getCatalogue(query);
  const pageLink = (page: number) =>
    `/shop?${new URLSearchParams({ q: query.q, category: query.category, brand: query.brand, page: String(page) })}`;
  return (
    <section className="container page-section">
      <div className="shop-intro">
        <p className="eyebrow">Find your everyday favourites</p>
        <h1>The beauty collection</h1>
        <p>Skincare, fragrance, makeup. Make it your own.</p>
      </div>
      <form action="/shop" className="filter-bar">
        <div className="search-field">
          <Search size={19} />
          <label className="sr-only" htmlFor="search">
            Search products or brands
          </label>
          <input
            id="search"
            name="q"
            maxLength={100}
            defaultValue={query.q}
            placeholder="Search products or brands"
          />
        </div>
        <label>
          <span className="sr-only">Category</span>
          <select name="category" defaultValue={query.category}>
            <option value="">All categories</option>
            {result.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Brand</span>
          <select name="brand" defaultValue={query.brand}>
            <option value="">All brands</option>
            {result.brands.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Find products <ArrowRight size={15} />
        </button>
      </form>
      {result.unavailable ? (
        <div className="empty-state">
          <Leaf size={38} strokeWidth={1} />
          <h2>Our collection is being prepared</h2>
          <p>Please check back soon.</p>
        </div>
      ) : (
        <>
          <div className="results-line">
            <p>
              {result.total} {result.total === 1 ? "product" : "products"}
            </p>
            {(query.q || query.category || query.brand) && (
              <Link href="/shop">Clear filters</Link>
            )}
          </div>
          {result.products.some((p) => p.isDemo) && (
            <p className="catalogue-note">
              Sample collection · Demonstration products and prices, not for
              sale.
            </p>
          )}
          {result.products.length ? (
            <div className="product-grid">
              {result.products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No products found</h2>
              <p>Try another search or explore all categories.</p>
              <Link href="/shop" className="button">
                Clear filters
              </Link>
            </div>
          )}
          {result.total > PAGE_SIZE && (
            <nav className="pagination" aria-label="Catalogue pages">
              {query.page > 1 && (
                <Link
                  className="outline-button"
                  href={pageLink(query.page - 1)}
                >
                  Previous
                </Link>
              )}
              <span>
                Page {query.page} of {Math.ceil(result.total / PAGE_SIZE)}
              </span>
              {query.page * PAGE_SIZE < result.total && (
                <Link
                  className="outline-button"
                  href={pageLink(query.page + 1)}
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
