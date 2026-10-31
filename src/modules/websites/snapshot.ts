import type { LinkedData } from "./linked";
import { parsePageData, type PageData } from "./registry";

/**
 * A publication snapshot (docs/WEBSITE_PUBLISHING.md#published-snapshots):
 * the approved page data plus the public-safe linked data resolved, with the
 * publisher's permissions, at publication time. Public routes render only
 * this; they never read CRM records for content. `assets` maps the media IDs
 * the page shows to their storage objects and is used only by the public
 * media route on the server; it is never passed to a component.
 */
export interface PublishedSnapshot {
  schemaVersion: 1;
  versionNumber: number;
  publishedAt: string;
  title: string;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  data: PageData;
  linked: LinkedData;
  assets: Record<string, {storagePath: string; contentType: string}>;
  /** CRM records whose live status is re-checked before every public view. */
  sources: {listingIds: string[]; projectIds: string[]; propertyIds: string[]};
  ogImageMediaId: string | null;
  /** Absolute stock URL or a public media path; absent in snapshots published before stock media existed. */
  ogImageUrl?: string | null;
}

export function parseSnapshot(raw: string): PublishedSnapshot | null {
  try {
    const value = JSON.parse(raw) as PublishedSnapshot;
    if (!value || value.schemaVersion !== 1 || typeof value.title !== "string" || !value.linked || typeof value.assets !== "object" || !value.sources) return null;
    return {...value, data: parsePageData(value.data)};
  } catch {
    return null;
  }
}

/** Public media path for one approved image of one live publication. */
export const publicMediaPath = (publicationId: string, mediaId: string) => `/api/public/site-media/${publicationId}/${mediaId}`;
export const publicPagePath = (companySlug: string, pageSlug: string) => `/site/${encodeURIComponent(companySlug)}/${encodeURIComponent(pageSlug)}`;
export const enquiryEndpoint = (companySlug: string, pageSlug: string) => `/api/public/sites/${encodeURIComponent(companySlug)}/${encodeURIComponent(pageSlug)}/enquiries`;

/** Public slugs are lowercase words joined by hyphens; anything else is not a page. */
export const isPublicSlug = (value: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value) && value.length <= 80;

/**
 * Live eligibility of a published page's sources. A withdrawn, sold,
 * unpublished, archived or expired-permit listing, or an inactive or
 * expired-permit project, takes the page offline until it is reviewed and
 * republished. Only status fields are read.
 */
export function sourcesStillEligible(input: {
  listings: Array<{listingStatus: string; publicationStatus: string; advertisingPermitNumber?: string | null; permitExpiryDate?: string | null; archivedAt?: string | null; property?: {archivedAt?: string | null} | null}>;
  projects: Array<{projectStatus: string; archivedAt?: string | null; permitExpiryDate?: string | null}>;
  properties: Array<{archivedAt?: string | null}>;
  expected: PublishedSnapshot["sources"];
  today: string;
}) {
  if (input.listings.length !== input.expected.listingIds.length || input.projects.length !== input.expected.projectIds.length || input.properties.length !== input.expected.propertyIds.length) return false;
  const listingsOk = input.listings.every(listing => listing.listingStatus === "ACTIVE" && listing.publicationStatus === "PUBLISHED" && !listing.archivedAt && !listing.property?.archivedAt
    && Boolean(listing.advertisingPermitNumber?.trim()) && (!listing.permitExpiryDate || listing.permitExpiryDate.slice(0, 10) >= input.today));
  const projectsOk = input.projects.every(project => !project.archivedAt && (project.projectStatus === "ACTIVE" || project.projectStatus === "COMPLETED")
    && (!project.permitExpiryDate || project.permitExpiryDate.slice(0, 10) >= input.today));
  const propertiesOk = input.properties.every(property => !property.archivedAt);
  return listingsOk && projectsOk && propertiesOk;
}
