import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { verifyStaff } from "@/server/staff";
import { getAuth } from "@/server/auth";
import { MfaSetup } from "@/components/mfa";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page() {
  const h = await headers();
  try {
    await verifyStaff(h, true);
  } catch {
    redirect("/staff/sign-in");
  }
  const session = await getAuth().api.getSession({ headers: h });
  return <MfaSetup enabled={!!session?.user.twoFactorEnabled} />;
}
