import { redirect } from "next/navigation";
import { requireStaffPage } from "@/server/staff";
import { StoreSettingsWorkspace } from "@/components/admin/settings";
export default async function Page() {
  const actor = await requireStaffPage();
  if (actor.role !== "OWNER") redirect("/staff/access-denied");
  return <StoreSettingsWorkspace />;
}
