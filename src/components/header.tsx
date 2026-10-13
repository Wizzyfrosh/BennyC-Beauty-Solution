import Link from "next/link";
import { Leaf, Menu, Search, ShoppingBag, UserRound } from "lucide-react";
import { Brand } from "./brand";
export function Header() {
  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>
            <Leaf size={13} /> Your everyday beauty destination
          </span>
          <nav aria-label="Quick links">
            <Link href="/shopping-guide">Shopping guide</Link>
            <span>│</span>
            <Link href="/about">About BennyC</Link>
            <span>│</span>
            <Link href="/staff/sign-in">Staff sign in</Link>
          </nav>
        </div>
      </div>
      <div className="container main-nav">
        <Brand />
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link href="/" className="home-nav">
            Home
          </Link>
          <Link href="/shop">Shop</Link>
          <Link href="/#categories">Collections</Link>
          <Link href="/about">Our story</Link>
          <Link href="/shopping-guide">Beauty essentials</Link>
        </nav>
        <div className="nav-actions">
          <Link
            className="icon-button"
            href="/shop#search"
            aria-label="Search products"
          >
            <Search size={21} strokeWidth={1.5} />
          </Link>
          <Link
            className="icon-button account-link"
            href="/staff/sign-in"
            aria-label="Staff sign in"
          >
            <UserRound size={21} strokeWidth={1.5} />
          </Link>
          <Link
            className="icon-button"
            href="/shopping-guide"
            aria-label="Shopping and ordering information"
          >
            <ShoppingBag size={21} strokeWidth={1.5} />
          </Link>
        </div>
        <details className="mobile-menu">
          <summary aria-label="Open navigation">
            <Menu size={23} />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            <Link href="/shop">Shop all</Link>
            <Link href="/#categories">Collections</Link>
            <Link href="/about">Our story</Link>
            <Link href="/staff/sign-in">Staff sign in</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
