import "server-only";

import { connectorConfig } from "@dataconnect/admin-generated";
import * as sdk from "@dataconnect/admin-generated";
import { getDataConnect } from "firebase-admin/data-connect";
import { getFirebaseAdminApp } from "@/lib/firebase/admin";
import { getAppOrigin } from "@/modules/auth/server/config";
import { captureWebsiteSubmission } from "@/modules/lead-capture/server/service";
import { assertSafeDataConnectEnvironment } from "@/modules/organizations/server/dataconnect-policy";
import { WorkspaceError, mapWorkspaceDataError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { sectionWidgets } from "../registry";
import { isPublicSlug, parseSnapshot, publicPagePath, sourcesStillEligible, type PublishedSnapshot } from "../snapshot";
import { presentFormView, type PageFormView } from "../types";

/*
 * Public website reads (no session). Tenancy comes only from the stored
 * publication that matches the company slug and page slug; nothing in the
 * request names a company. Only ACTIVE publications are readable, their
 * content is the snapshot taken at publication, and the bound lead form is
 * read only to render and accept its fields. All operations are NO_ACCESS
 * and run here, on the server.
 */

function adminDataConnect() {
  assertSafeDataConnectEnvironment({nodeEnv: process.env.NODE_ENV, emulatorHost: process.env.DATA_CONNECT_EMULATOR_HOST});
  return getDataConnect(connectorConfig, getFirebaseAdminApp());
}

async function run<T>(operation: () => Promise<{data: T}>): Promise<T> {
  try { return (await operation()).data; } catch (error) { throw mapWorkspaceDataError(error); }
}

/** Server-only (NO_ACCESS) operations for other website server modules. */
export const serverDataConnect = adminDataConnect;
export const serverOperation = run;

export interface PublishedPage {
  organization: {id: string; name: string; slug: string};
  publicationId: string;
  pageId: string;
  snapshot: PublishedSnapshot;
  form: PageFormView | null;
  rawForm: NonNullable<Awaited<ReturnType<typeof sdk.getPublishedPageForm>>["data"]["binding"]>["form"] | null;
}

/** The live page, or null when it does not exist, is not live, or a linked listing or project can no longer be advertised. */
export async function loadPublishedPage(companySlug: string, pageSlug: string): Promise<PublishedPage | null> {
  if (!isPublicSlug(companySlug) || !isPublicSlug(pageSlug)) return null;
  const dc = adminDataConnect();
  const data = await run(() => sdk.resolvePublishedPage(dc, {companySlug, pageSlug}));
  const row = data.publications[0];
  if (!row) return null;
  const snapshot = parseSnapshot(row.snapshot);
  if (!snapshot) {
    console.error(JSON.stringify({event: "website.public.invalid_snapshot", publicationId: canonicalUuid(row.id)}));
    return null;
  }
  const organizationId = canonicalUuid(row.organizationId);
  const pageId = canonicalUuid(row.pageId);
  const [eligibility, binding] = await Promise.all([
    run(() => sdk.checkPublishedSourcesEligibility(dc, {organizationId, ...snapshot.sources})),
    run(() => sdk.getPublishedPageForm(dc, {organizationId, pageId})),
  ]);
  if (!sourcesStillEligible({...eligibility, expected: snapshot.sources, today: new Date().toISOString().slice(0, 10)})) {
    console.info(JSON.stringify({event: "website.public.offline", publicationId: canonicalUuid(row.id), reason: "SOURCE_NOT_ELIGIBLE"}));
    return null;
  }
  const form = binding.binding?.form && canonicalUuid(binding.binding.form.organizationId) === organizationId && binding.binding.form.status === "ACTIVE" ? binding.binding.form : null;
  return {
    organization: {id: organizationId, name: row.organization.name, slug: row.organization.slug},
    publicationId: canonicalUuid(row.id), pageId, snapshot,
    form: form ? presentFormView(form, form.status) : null, rawForm: form,
  };
}

/** The storage object for an image of a live publication, if the page shows it. */
export async function publicMediaObject(publicationId: string, mediaId: string) {
  // IDs may arrive dashed or in SQL Connect's 32-character form.
  const uuid = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
  if (!uuid.test(publicationId) || !uuid.test(mediaId)) return null;
  const data = await run(() => sdk.getPublishedPageAsset(adminDataConnect(), {publicationId: canonicalUuid(publicationId)}));
  if (!data.publication) return null;
  const snapshot = parseSnapshot(data.publication.snapshot);
  return snapshot?.assets[canonicalUuid(mediaId)] ?? null;
}

export async function sitemapEntries() {
  const data = await run(() => sdk.listPublishedPagesForSitemap(adminDataConnect(), {limit: 5000}));
  return data.publications.filter(row => isPublicSlug(row.organization.slug) && isPublicSlug(row.pageSlug))
    .map(row => ({path: publicPagePath(row.organization.slug, row.pageSlug), lastModified: row.publishedAt}));
}

/** Text describing what the enquiry is about, built from the snapshot (never from the request). */
function propertyReference(snapshot: PublishedSnapshot) {
  const linked = snapshot.linked;
  const subject = linked.listing ? `Listing: ${linked.listing.title}` : linked.project ? `Project: ${linked.project.name}` : null;
  return [`Landing page: ${snapshot.title}`, subject].filter(Boolean).join(" · ").slice(0, 500);
}

/**
 * A landing page enquiry, through the existing website lead capture (same
 * validation, rate limit, duplicate handling, distribution, notifications
 * and consent evidence). The page must be live and show an enquiry form.
 */
export async function submitPageEnquiry(input: {companySlug: string; pageSlug: string; idempotencyKey: string; rawBody: unknown}) {
  const page = await loadPublishedPage(input.companySlug, input.pageSlug);
  // The page must show the form: an enquiry form section, or a form widget, on a visible section.
  const showsForm = page?.snapshot.data.sections.some(section => section.visible && (section.type === "ENQUIRY_FORM" || sectionWidgets(section).some(item => item.widget.type === "FORM")));
  if (!page || !page.rawForm || !showsForm) throw new WorkspaceError("FORM_UNAVAILABLE", 404, "This form is unavailable.");
  const form = page.rawForm;
  const path = publicPagePath(page.organization.slug, input.pageSlug);
  const result = await captureWebsiteSubmission({
    form: {...form, id: canonicalUuid(form.id), organizationId: canonicalUuid(form.organizationId)},
    idempotencyKey: input.idempotencyKey, rawBody: input.rawBody,
    page: {pageId: page.pageId, publicationId: page.publicationId, landingPageUrl: `${getAppOrigin()}${path}`, propertyReference: propertyReference(page.snapshot)},
  });
  if (!result.pending && !result.duplicate && result.leadId) {
    const raw = input.rawBody as {attribution?: {utmSource?: unknown; utmMedium?: unknown; utmCampaign?: unknown}} | null;
    const utm = (value: unknown) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 200) || null : null;
    try {
      await run(() => sdk.recordWebsitePageEnquiry(adminDataConnect(), {
        organizationId: page.organization.id, pageId: page.pageId, publicationId: page.publicationId, formId: canonicalUuid(form.id), leadId: result.leadId!,
        utmSource: utm(raw?.attribution?.utmSource), utmMedium: utm(raw?.attribution?.utmMedium), utmCampaign: utm(raw?.attribution?.utmCampaign),
      }));
    } catch {
      // The lead exists with the page URL as its landing page; only the page link record is missing.
      console.error(JSON.stringify({event: "website.enquiry.link_failed", pageId: page.pageId}));
    }
  }
  return result;
}
