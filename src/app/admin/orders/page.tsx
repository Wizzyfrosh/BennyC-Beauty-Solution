import { requireStaffPage } from "@/server/staff";
import { OrdersWorkspace } from "@/components/admin/orders";
export default async function Page() {
  await requireStaffPage();
  return <OrdersWorkspace />;
}
