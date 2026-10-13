import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "BennyC Beauty Solution | Cosmetics & Makeup",
    template: "%s | BennyC Beauty Solution",
  },
  description:
    "Explore skincare, body care, fragrance and makeup at BennyC Beauty Solution — Cosmetics & Makeup Venture.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-NG">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
