import { LockKeyhole } from "lucide-react";
import { SignInForm } from "@/components/sign-in-form";
import { isServerConfigured } from "@/server/env";
export const dynamic = "force-dynamic";
export const metadata = { title: "Staff sign in" };
export default function SignIn() {
  return (
    <section className="login-page">
      <div className="login-card">
        <div className="login-icon">
          <LockKeyhole size={26} strokeWidth={1.3} />
        </div>
        <p className="eyebrow">BennyC staff workspace</p>
        <h1>Welcome back.</h1>
        <p>Sign in to your store workspace.</p>
        <SignInForm configured={isServerConfigured()} />
      </div>
    </section>
  );
}
