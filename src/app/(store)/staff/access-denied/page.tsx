import { SignOutButton } from "@/components/sign-out-button";
export default function Denied() {
  return (
    <section className="container page-section empty-state">
      <h1>Staff access required</h1>
      <p>
        This account does not have active staff access. Contact the store owner
        if you believe this is a mistake.
      </p>
      <SignOutButton />
    </section>
  );
}
