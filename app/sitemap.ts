import type { MetadataRoute } from "next";
import { withUserRls } from "@/lib/db";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ventramatch.com";

/**
 * Programmatic sitemap. Includes static routes + opted-in public profiles.
 * Submitted to Google Search Console via /robots.txt → Sitemap directive.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/legal/tos`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  // Public profiles
  let profileRoutes: MetadataRoute.Sitemap = [];
  try {
    const slugs = await withUserRls<{ slug: string; updated: Date | string }[]>(
      null,
      async (sql) =>
        sql<{ slug: string; updated: Date | string }[]>`
          select public_slug as slug, updated_at as updated
          from public.users
          where public_profile_enabled = true
            and public_slug is not null
            and account_label = 'verified'
        `,
    );
    profileRoutes = slugs.map((s) => ({
      url: `${SITE_URL}/u/${s.slug}`,
      lastModified: new Date(s.updated),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch {
    // DB unavailable — still return static routes.
  }

  return [...staticRoutes, ...profileRoutes];
}
