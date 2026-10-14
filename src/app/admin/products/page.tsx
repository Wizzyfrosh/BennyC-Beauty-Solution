import { redirect } from "next/navigation";
import { requireStaffPage } from "@/server/staff";
import { ProductsWorkspace } from "@/components/admin/products";
export default async function Page() {
  const actor = await requireStaffPage();
  if (actor.role !== "OWNER") redirect("/staff/access-denied");
  return <ProductsWorkspace />;
}
