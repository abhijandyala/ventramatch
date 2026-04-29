import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VentraMatch — fundraising matching for startups and investors",
  description:
    "Stop emailing the wrong investors. VentraMatch surfaces high-fit founder–investor matches based on stage, sector, check size, geography, and traction.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "VentraMatch",
    description:
      "Fundraising matching for startups and investors. Score-based, mutual-interest unlocked.",
    siteName: "VentraMatch",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
