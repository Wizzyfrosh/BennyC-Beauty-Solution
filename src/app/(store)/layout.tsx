import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { StorefrontMotion } from "@/components/storefront-motion";
export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main id="main">{children}</main>
      <Footer />
      <StorefrontMotion />
    </>
  );
}
