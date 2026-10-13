import Link from "next/link";
import { Leaf } from "lucide-react";
export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link
      href="/"
      className={`brand ${dark ? "brand-dark" : ""}`}
      aria-label="BennyC Beauty Solution home"
    >
      <span className="brand-mark">
        <Leaf size={27} strokeWidth={1.4} />
      </span>
      <span>
        <span className="brand-name">
          BennyC <span>Beauty Solution</span>
        </span>
        <span className="brand-tagline">Cosmetics &amp; Makeup Venture</span>
      </span>
    </Link>
  );
}
