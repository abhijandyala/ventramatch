import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ventramatch.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/", "/legal/"],
        disallow: [
          "/dashboard", "/feed", "/matches", "/inbox", "/settings",
          "/build", "/profile", "/p/", "/admin", "/api/",
          "/onboarding", "/post-auth", "/homepage", "/searches",
          "/activity", "/notifications", "/feedback", "/help",
          "/banned", "/verify-email", "/reference",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
