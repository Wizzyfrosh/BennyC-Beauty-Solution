"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Package,
  LayoutDashboard,
  ShoppingBag,
  Store,
  UserRound,
} from "lucide-react";
export function AdminNav({ owner }: { owner: boolean }) {
  const path = usePathname();
  const links = [
    ...(owner
      ? [
          { href: "/admin/reports", label: "Reports", Icon: LayoutDashboard },
          { href: "/admin/operations", label: "Operations", Icon: Boxes },
          { href: "/admin/staff", label: "Staff access", Icon: UserRound },
          { href: "/admin/settings", label: "Business settings", Icon: Store },
        ]
      : []),
    { href: "/staff/security", label: "Authenticator", Icon: UserRound },
    ...(owner
      ? [
          {
            href: "/admin/payments",
            label: "Payment resolution",
            Icon: ShoppingBag,
          },
        ]
      : []),
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
