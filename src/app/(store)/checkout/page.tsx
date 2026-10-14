import { CheckoutPage } from "@/components/checkout";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <CheckoutPage
      enabled={
        process.env.NODE_ENV !== "production" &&
        process.env.BENNYC_DEMO_CHECKOUT === "true"
      }
    />
  );
}
