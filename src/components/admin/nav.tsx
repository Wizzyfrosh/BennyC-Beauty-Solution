"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Package,
  LayoutDashboard,
  ShoppingBag,
  Store,
} from "lucide-react";
export function AdminNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const links = [
    { href: "/admin", label: "Overview", Icon: LayoutDashboard },
    ...(owner
      ? [{ href: "/admin/products", label: "Products", Icon: Package }]
      : []),
    { href: "/admin/orders", label: "Website orders", Icon: ShoppingBag },
    ...(owner
      ? [{ href: "/admin/delivery", label: "Delivery areas", Icon: Store }]
      : []),
    { href: "/admin/inventory", label: "Inventory", Icon: Boxes },
    { href: "/admin/sales/new", label: "Record sale", Icon: ShoppingBag },
    { href: "/shop", label: "View storefront", Icon: Store },
  ];
  return (
    <nav aria-label="Staff workspace">
      {links.map(({ href, label, Icon }) => (
        <Link
          href={href}
          key={href}
          className={path === href ? "active" : ""}
          aria-current={path === href ? "page" : undefined}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
