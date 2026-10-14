import { getDb } from "@/server/db";
import { isServerConfigured } from "@/server/env";
export const dynamic = "force-dynamic";
export default async function Page() {
  const data = isServerConfigured()
    ? await getDb()
        .storeSettings.findUnique({
          where: { id: 1 },
          select: {
            phone: true,
            email: true,
            pickupAddress: true,
            businessHours: true,
            privacyPolicy: true,
            returnsPolicy: true,
            deliveryPolicy: true,
          },
        })
        .catch(() => null)
    : null;
  return (
    <section className="container page-section reading-page">
      <p className="eyebrow">Owner-provided shop information</p>
      <h1>Contact & policies</h1>
      {data?.phone && <p>Phone: {data.phone}</p>}
      {data?.email && <p>Email: {data.email}</p>}
      {data?.pickupAddress && <p>Pickup: {data.pickupAddress}</p>}
      {data?.businessHours && <p>Hours: {data.businessHours}</p>}
      {[
        ["Privacy", data?.privacyPolicy],
        ["Returns", data?.returnsPolicy],
        ["Delivery", data?.deliveryPolicy],
      ].map(([label, text]) => (
        <article className="info-card" key={label}>
          <h2>{label}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {text ||
              "Owner-approved information has not been published yet. Online shopping remains closed."}
          </p>
        </article>
      ))}
    </section>
  );
}
