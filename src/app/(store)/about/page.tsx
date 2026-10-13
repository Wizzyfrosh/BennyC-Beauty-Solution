import Link from "next/link";
import Image from "next/image";
export const metadata = { title: "Our story" };
export default function About() {
  return (
    <section className="container page-section story-layout">
      <div>
        <p className="eyebrow">Welcome to BennyC</p>
        <h1>
          Beauty for your
          <br />
          everyday ritual.
        </h1>
        <p className="lead">
          BennyC Beauty Solution / Cosmetics &amp; Makeup Venture.
        </p>
        <p>
          A place to explore cosmetics, body lotions, perfumes, makeup and the
          little essentials that make a routine your own.
        </p>
        <p>
          We’re preparing our online collection. Store information and ordering
          details will be added before online shopping opens.
        </p>
        <Link href="/shop" className="button">
          Explore the collection
        </Link>
      </div>
      <div className="story-image">
        <Image
          src="/images/beauty-ritual.png"
          alt="Illustrative botanical beauty display"
          fill
          sizes="(max-width: 700px) 90vw, 50vw"
          style={{ objectFit: "cover", objectPosition: "20% center" }}
        />
      </div>
    </section>
  );
}
