import Link from "next/link";
export const metadata = { title: "Shopping information" };
export default function Guide() {
  return (
    <section className="container page-section reading-page">
      <p className="eyebrow">Before you shop</p>
      <h1>A little shopping guidance.</h1>
      <p className="lead">
        Our online store is being prepared. You can explore the catalogue;
        online ordering is not open yet.
      </p>
      <div className="info-card">
        <h2>Products & options</h2>
        <p>
          Choose a product to see its sizes or shades and the price of each
          option. Items marked Sample are demonstration products and are not for
          sale.
        </p>
      </div>
      <div className="info-card">
        <h2>Pickup, delivery & returns</h2>
        <p>
          Confirmed pickup details, delivery areas, charges and the returns
          policy will be published before checkout opens.
        </p>
      </div>
      <div className="info-card">
        <h2>Product information</h2>
        <p>
          Review the packaging directions and ingredients when choosing a
          product. Sample photographs are illustrative and do not represent
          confirmed store stock.
        </p>
      </div>
      <Link className="button" href="/shop">
        Browse the collection
      </Link>
    </section>
  );
}
