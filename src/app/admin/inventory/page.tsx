import { requireStaffPage } from "@/server/staff";
import { InventoryWorkspace } from "@/components/admin/inventory";
export default async function Page() {
  const actor = await requireStaffPage();
  return <InventoryWorkspace owner={actor.role === "OWNER"} />;
}
