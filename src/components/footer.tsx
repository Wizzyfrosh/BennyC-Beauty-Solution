import Link from "next/link";
import { Brand } from "./brand";
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div>
          <Brand dark />
          <p>Everyday essentials. A little more you.</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/shop">Explore the collection</Link>
          <Link href="/about">About BennyC</Link>
          <Link href="/shopping-guide">Shopping guide</Link>
          <Link href="/staff/sign-in">Staff area</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} BennyC Beauty Solution</span>
        <span>Cosmetics &amp; Makeup Venture</span>
      </div>
    </footer>
  );
}
