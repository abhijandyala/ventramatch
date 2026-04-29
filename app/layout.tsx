import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VentraMatch — fundraising matching for startups and investors",
  description:
    "VentraMatch scores every investor against your raise on sector, stage, check size, geography, and traction. Mutual interest unlocks contact. No cold-email lottery.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "VentraMatch",
    description:
      "Score-based fundraising matching for founders and investors. Mutual interest unlocks contact.",
    siteName: "VentraMatch",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f9fafb",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
