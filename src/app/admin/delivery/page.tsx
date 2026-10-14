import { redirect } from "next/navigation";
import { requireStaffPage } from "@/server/staff";
import { DeliveryWorkspace } from "@/components/admin/orders";
export default async function Page() {
  const actor = await requireStaffPage();
  if (actor.role !== "OWNER") redirect("/staff/access-denied");
  return <DeliveryWorkspace />;
}
