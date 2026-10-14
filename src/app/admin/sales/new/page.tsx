import { requireStaffPage } from "@/server/staff";
import { SaleWorkspace } from "@/components/admin/sale";
export default async function Page() {
  await requireStaffPage();
  return <SaleWorkspace />;
}
