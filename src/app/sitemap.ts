import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { getAppOrigin } from "@/modules/auth/server/config";
import { sitemapEntries } from "@/modules/websites/server/public";

/**
 * Public URLs: the marketing home and every live landing page. Drafts,
 * previews and unpublished pages are never listed. Built per request so an
 * unpublished page disappears immediately.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = getAppOrigin();
  const pages = await sitemapEntries().catch(() => []);
  return [
    {url: `${origin}/`, changeFrequency: "monthly", priority: 0.5},
    ...pages.map(page => ({url: `${origin}${page.path}`, lastModified: page.lastModified, changeFrequency: "weekly" as const, priority: 0.8})),
  ];
}
