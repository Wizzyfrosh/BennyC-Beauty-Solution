import "server-only";
import { getDb } from "./db";
import { verifyStaff } from "./staff";
export async function getStaffOverview(headers: Headers) {
  const member = await verifyStaff(headers);
  const [published, drafts, variants] = await getDb().$transaction([
    getDb().product.count({ where: { status: "PUBLISHED" } }),
    getDb().product.count({ where: { status: "DRAFT" } }),
    getDb().productVariant.count({
      where: { active: true, product: { status: { not: "ARCHIVED" } } },
    }),
  ]);
  return { member, counts: { published, drafts, variants } };
}
