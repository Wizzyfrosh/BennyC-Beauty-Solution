import Link from "next/link";
import { LayoutDashboard, Store } from "lucide-react";
import { Brand } from "@/components/brand";
import { SignOutButton } from "@/components/sign-out-button";
import { requireStaffPage } from "@/server/staff";
import { isServerConfigured } from "@/server/env";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isServerConfigured())
    return (
      <main id="main" className="standalone-page">
        <h1>Staff workspace unavailable</h1>
        <p>The store workspace is not ready yet. Please contact the owner.</p>
        <Link href="/" className="button">
          Return to the shop
        </Link>
      </main>
    );
  const member = await requireStaffPage();
  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <Brand dark />
        <p className="eyebrow">Store workspace</p>
        <nav>
          <Link href="/admin" className="active">
            <LayoutDashboard size={18} /> Overview
          </Link>
          <Link href="/shop">
            <Store size={18} /> View storefront
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <strong>{member.name}</strong>
          <span>
            {member.role === "OWNER" ? "Store owner" : "Staff member"}
          </span>
          <SignOutButton />
        </div>
      </aside>
      <main id="main" className="admin-main">
        {children}
      </main>
    </div>
  );
}
