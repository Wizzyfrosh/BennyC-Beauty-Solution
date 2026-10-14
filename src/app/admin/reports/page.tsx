import { redirect } from "next/navigation";
import { requireStaffPage } from "@/server/staff";
import { ReportsWorkspace } from "@/components/admin/reports";
export default async function Page() {
  const actor = await requireStaffPage();
  if (actor.role !== "OWNER") redirect("/staff/access-denied");
  return (
    <ReportsWorkspace
      today={new Date().toLocaleDateString("en-CA", {
        timeZone: "Africa/Lagos",
      })}
    />
  );
}
