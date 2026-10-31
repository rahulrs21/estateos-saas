import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { getAppOrigin } from "@/modules/auth/server/config";
import { PageRenderer } from "@/modules/websites/components/page-renderer";
import { pageFontVariables } from "@/modules/websites/fonts";
import { loadPublishedPage } from "@/modules/websites/server/public";
import { enquiryEndpoint, publicMediaPath, publicPagePath } from "@/modules/websites/snapshot";

type Params = Promise<{companySlug: string; pageSlug: string}>;

/*
 * Public landing pages (docs/WEBSITE_PUBLISHING.md#public-pages). No login.
 * Content comes only from the live publication snapshot for this company and
 * page slug; drafts, previews and CRM records are never read here. Rendered
 * per request (no shared cache), so unpublishing takes effect immediately.
 */

// One database read per request for both the metadata and the page.
const loadPage = cache(async (companySlug: string, pageSlug: string) => {
  try { return await loadPublishedPage(companySlug, pageSlug); } catch { return null; }
});

export async function generateMetadata({params}: {params: Params}): Promise<Metadata> {
  const {companySlug, pageSlug} = await params;
  const page = await loadPage(companySlug, pageSlug);
  if (!page) return {title: {absolute: "Page not found"}, robots: {index: false, follow: false}};
  const {snapshot} = page;
  const origin = getAppOrigin();
  const url = `${origin}${publicPagePath(page.organization.slug, pageSlug)}`;
  const title = snapshot.seoTitle || snapshot.title;
  const description = snapshot.seoDescription || snapshot.description || undefined;
  const sharing = snapshot.ogImageUrl ?? (snapshot.ogImageMediaId ? publicMediaPath(page.publicationId, snapshot.ogImageMediaId) : null);
  const image = sharing ? (sharing.startsWith("/") ? `${origin}${sharing}` : sharing) : undefined;
  return {
    title: {absolute: title}, description,
    alternates: {canonical: url},
    openGraph: {type: "website", url, title, description, siteName: snapshot.linked.company.name, locale: "en_AE", ...(image ? {images: [{url: image, alt: title}]} : {})},
    twitter: {card: image ? "summary_large_image" : "summary", title, description, ...(image ? {images: [image]} : {})},
    robots: {index: true, follow: true},
  };
}

async function PublishedLandingPage({params}: {params: Params}) {
  const {companySlug, pageSlug} = await params;
  const page = await loadPage(companySlug, pageSlug);
  if (!page) notFound();
  const {snapshot} = page;
  return <div id="main-content" className={`min-h-dvh ${pageFontVariables}`}>
    <PageRenderer mode="public" today={new Date().toISOString().slice(0, 10)}
      page={{title: snapshot.title, data: snapshot.data, linked: snapshot.linked, form: page.form}}
      publicContext={{enquiryEndpoint: enquiryEndpoint(page.organization.slug, pageSlug), pageTitle: snapshot.title}} />
  </div>;
}

export default function PublicSitePage({params}: {params: Params}) {
  return <Suspense fallback={<div className="min-h-dvh animate-pulse bg-muted/40" aria-busy="true" aria-label="Loading page" />}>
    <PublishedLandingPage params={params} />
  </Suspense>;
}
