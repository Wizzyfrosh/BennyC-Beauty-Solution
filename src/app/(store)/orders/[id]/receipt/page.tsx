import { notFound } from "next/navigation";
import { z } from "zod";
import { ReceiptPage } from "@/components/receipt";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return <ReceiptPage id={id} />;
}
