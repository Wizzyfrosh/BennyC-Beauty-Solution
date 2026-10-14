import { OrderStatus } from "@/components/order-status";
import { notFound } from "next/navigation";
import { z } from "zod";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <OrderStatus
      providerEnabled={
        process.env.NODE_ENV !== "production" &&
        process.env.BENNYC_PAYSTACK_TEST === "true"
      }
      id={id}
      enabled={
        process.env.NODE_ENV !== "production" &&
        process.env.BENNYC_DEMO_CHECKOUT === "true"
      }
    />
  );
}
