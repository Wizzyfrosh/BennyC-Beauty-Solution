import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="standalone-page">
      <span className="eyebrow">BennyC Beauty Solution</span>
      <h1>A little off the beauty path.</h1>
      <p>This page or product isn’t available.</p>
      <Link className="button" href="/shop">
        Back to the collection
      </Link>
    </main>
  );
}
