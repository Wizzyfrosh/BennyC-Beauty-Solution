import { redirect } from "next/navigation";
import { requireStaffPage } from "@/server/staff";
import { OperationsWorkspace } from "@/components/admin/operations";
export default async function Page() {
  const actor = await requireStaffPage();
  if (actor.role !== "OWNER") redirect("/staff/access-denied");
  return <OperationsWorkspace />;
}
