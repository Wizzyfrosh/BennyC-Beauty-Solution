import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Boxes, Package, ShoppingBag } from "lucide-react";
import { getStaffOverview } from "@/server/overview";
import { isServerConfigured } from "@/server/env";
import { StaffAccessError } from "@/server/staff";
import Link from "next/link";
export default async function Admin() {
  if (!isServerConfigured()) return null;
  const { member, counts } = await getStaffOverview(await headers()).catch(
    (error) => {
      if (error instanceof StaffAccessError && error.status === 401)
        redirect("/staff/sign-in");
      if (error instanceof StaffAccessError && error.status === 403)
        redirect("/staff/access-denied");
      throw error;
    },
  );
  return (
    <>
      <div className="admin-heading">
        <p className="eyebrow">BennyC Beauty Solution</p>
        <h1>Store overview</h1>
        <p>Welcome, {member.name}. Here’s your catalogue at a glance.</p>
      </div>
      <div className="stat-grid">
        {[
          ["Published products", counts.published],
          ["Draft products", counts.drafts],
          ["Active product options", counts.variants],
        ].map(([label, value]) => (
          <div className="stat-card" key={label}>
            <Package size={20} />
            <span>{label}</span>
            <strong>{value}</strong>
            <small>Current catalogue</small>
          </div>
        ))}
      </div>
      <div className="admin-upcoming">
        <div className="info-card">
          <Boxes size={28} strokeWidth={1.2} />
          <h2>Inventory workspace</h2>
          <p>
            Receive stock, inspect batches, and review stock movements and
            expiry alerts.
          </p>
          <Link className="text-link" href="/admin/inventory">
            Open inventory
          </Link>
        </div>
        <div className="info-card">
          <ShoppingBag size={28} strokeWidth={1.2} />
          <h2>Orders workspace</h2>
          <p>
            Record completed shop or WhatsApp sales after verifying payment and
            handover. Website orders use the same physical stock and are
            prepared in the order queue.
          </p>
          <Link className="text-link" href="/admin/sales/new">
            Record a sale
          </Link>
        </div>
      </div>
      <p className="notice">
        These figures count catalogue records only. View inventory for stock
        balances and the sales workspace for completed sale records.
      </p>
    </>
  );
}
