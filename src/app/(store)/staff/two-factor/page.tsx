import { MfaChallenge } from "@/components/mfa";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default function Page() {
  return <MfaChallenge />;
}
