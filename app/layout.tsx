import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import { SkipLink } from "@/components/landing/skip-link";
import { SmoothScroll } from "@/components/landing/smooth-scroll";
import { CookieBanner } from "@/components/legal/cookie-banner";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ventramatch.com";

export const metadata: Metadata = {
  title: {
    default: "VentraMatch — fundraising matched.",
    template: "%s · VentraMatch",
  },
  description:
    "Score-based matching for founders and investors. VentraMatch scores every founder–investor pair on the five things both sides actually filter on — sector, stage, check size, geography, traction. Mutual interest unlocks contact.",
  applicationName: "VentraMatch",
  keywords: [
    "fundraising",
    "venture capital",
    "founder investor matching",
    "angel investors",
    "pre-seed",
    "seed funding",
    "startup matchmaking",
  ],
  authors: [{ name: "VentraMatch" }],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "VentraMatch",
    title: "VentraMatch — fundraising matched.",
    description:
      "Score-based matching for founders and investors. Mutual interest unlocks contact.",
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "VentraMatch — fundraising matched.",
    description:
      "Score-based matching for founders and investors. Mutual interest unlocks contact.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#f6efe8",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

// JSON-LD Organization schema for richer search results.
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "VentraMatch",
  url: SITE_URL,
  description:
    "Score-based matching for founders and investors. Mutual interest unlocks contact.",
  logo: `${SITE_URL}/logo.png`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${serif.variable}`}
      // Extensions often inject into <head> before hydration and break a JSON-LD
      // script there; body placement + this flag avoids noisy hydration mismatches.
      suppressHydrationWarning
    >
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <SkipLink />
        <SmoothScroll>{children}</SmoothScroll>
        <CookieBanner />
      </body>
    </html>
  );
}
