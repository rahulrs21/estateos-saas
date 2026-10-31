import "server-only";

import { createHash, randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { parseStoredPageData, type PageData } from "../registry";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Page scope (enforced again by every stored operation's membership check):
 * - reads: owners, administrators and managers see the company's pages;
 *   agents only pages they created;
 * - writes: owners and administrators any page; managers and agents only
 *   their own (agents only while the website allows agent drafts);
 * - approve, publish, unpublish, lead forms and settings: owners and administrators.
 */

export const isAdministrator = (context: Context) => context.membership.role === "OWNER" || context.membership.role === "ADMIN";
export const readScope = (context: Context) => context.membership.role === "AGENT" ? context.request.user.uid : undefined;
export const writeScope = (context: Context) => isAdministrator(context) ? undefined : context.request.user.uid;

const scoped = <T extends object>(vars: T, createdByUid: string | undefined) => (createdByUid ? {...vars, createdByUid} : vars);

export const PAGE_STATUSES = ["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export type PageStatus = (typeof PAGE_STATUSES)[number];

export interface DesignSettings { defaultStyle: string | null }
const parseDesignSettings = (raw: string): DesignSettings => {
  try { const value = JSON.parse(raw) as Partial<DesignSettings>; return {defaultStyle: typeof value.defaultStyle === "string" ? value.defaultStyle.slice(0, 40) : null}; } catch { return {defaultStyle: null}; }
};

/** A stable ID per company, so concurrent first visits create one default website. */
function defaultWebsiteId(organizationId: string) {
  const hex = createHash("sha256").update(`estateos-website:${canonicalUuid(organizationId)}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex[16], 16) & 3) | 8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export async function listPages(context: Context, statuses: PageStatus[], limit = 50, offset = 0) {
  const {request, organizationId} = context;
  const run = () => executeWorkspaceOperation(() => sql.listWebsitePages(request.dc, scoped({
    organizationId, statuses: statuses.map(status => sql.WebsitePageStatus[status]), limit, offset,
  }, readScope(context)), request.options), "ListWebsitePages");
  let data = await run();
  if (!data.websites.length) {
    // First use: create the company's default website (one per company, deterministic ID).
    try {
      await executeWorkspaceOperation(() => sql.createDefaultWebsite(request.dc, {
        organizationId, id: defaultWebsiteId(organizationId), actorUid: request.user.uid, name: `${context.organization.name}`.slice(0, 120) || "Website",
        slug: "main", designSettings: JSON.stringify({defaultStyle: null}),
      }), "CreateDefaultWebsite");
    } catch (error) {
      if (!(error instanceof WorkspaceError && error.code === "CONFLICT")) throw error;
    }
    data = await run();
  }
  const website = data.websites[0];
  if (!website) throw new WorkspaceError("DATA_UNAVAILABLE", 503, "The website could not be prepared. Try again.");
  return {
    organization: data.organization ?? {name: context.organization.name, slug: ""},
    website: {...website, id: canonicalUuid(website.id), designSettings: parseDesignSettings(website.designSettings)},
    pages: data.pages.map(page => ({...page, id: canonicalUuid(page.id), websiteId: canonicalUuid(page.websiteId), livePublicationId: page.livePublicationId ? canonicalUuid(page.livePublicationId) : null})),
    total: data.total[0]?.count ?? 0,
  };
}

export async function getPage(context: Context, id: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getWebsitePage(request.dc, scoped({organizationId, id}, readScope(context)), request.options), "GetWebsitePage");
  if (!data.page) throw new WorkspaceError("NOT_FOUND", 404, "This page is unavailable or outside the pages you can use.");
  const page = data.page;
  return {
    organization: data.organization ?? {name: context.organization.name, slug: ""},
    page: {
      ...page, id: canonicalUuid(page.id), websiteId: canonicalUuid(page.websiteId), website: {...page.website, id: canonicalUuid(page.website.id)},
      sourceProjectId: page.sourceProjectId ? canonicalUuid(page.sourceProjectId) : null, sourcePropertyId: page.sourcePropertyId ? canonicalUuid(page.sourcePropertyId) : null,
      sourceListingId: page.sourceListingId ? canonicalUuid(page.sourceListingId) : null, livePublicationId: page.livePublicationId ? canonicalUuid(page.livePublicationId) : null,
    },
    versions: data.versions.map(version => ({...version, id: canonicalUuid(version.id)})),
    publications: data.publications.map(publication => ({...publication, id: canonicalUuid(publication.id)})),
    binding: data.binding ? {formId: canonicalUuid(data.binding.formId), form: {...data.binding.form, id: canonicalUuid(data.binding.form.id)}, updatedAt: data.binding.updatedAt} : null,
    enquiryCount: data.enquiries[0]?.count ?? 0,
  };
}
export type StoredPage = Awaited<ReturnType<typeof getPage>>;

export async function getVersion(context: Context, pageId: string, versionNumber: number): Promise<{id: string; versionNumber: number; kind: string; data: PageData; validation: string | null; model: string | null; approvedAt: string | null; createdAt: string}> {
  const {request, organizationId} = context;
  const result = await executeWorkspaceOperation(() => sql.getPageVersion(request.dc, scoped({organizationId, pageId, versionNumber}, readScope(context)), request.options), "GetPageVersion");
  const version = result.version;
  if (!version) throw new WorkspaceError("NOT_FOUND", 404, "This page version is unavailable.");
  return {
    id: canonicalUuid(version.id), versionNumber: version.versionNumber, kind: version.kind, data: parseStoredPageData(version.structuredPageData),
    validation: version.validation ?? null, model: version.model ?? null, approvedAt: version.approvedAt ?? null, createdAt: version.createdAt,
  };
}

export async function slugTaken(context: Context, slug: string, exceptPageId?: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.findWebsitePageBySlug(request.dc, {organizationId, slug}, request.options), "FindWebsitePageBySlug");
  return Boolean(data.page && (!exceptPageId || canonicalUuid(data.page.id) !== canonicalUuid(exceptPageId)));
}

/** A free slug based on the requested one: name, name-2, name-3… */
export async function availableSlug(context: Context, base: string, exceptPageId?: string) {
  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 76)}-${attempt}`;
    if (!await slugTaken(context, candidate, exceptPageId)) return candidate;
  }
  return `${base.slice(0, 70)}-${randomUUID().slice(0, 6)}`;
}

export interface PageFields {
  title: string; slug: string; description: string | null; seoTitle: string | null; seoDescription: string | null; designStyle: string;
}

export async function createPage(context: Context, input: PageFields & {id: string; websiteId: string; kind: "CREATED" | "DUPLICATED"; data: PageData; validation: string | null; sources: {projectId: string | null; propertyId: string | null; listingId: string | null}}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.createWebsitePage(request.dc, {
    organizationId, id: input.id, websiteId: input.websiteId, title: input.title, slug: input.slug, description: input.description,
    sourceProjectId: input.sources.projectId, sourcePropertyId: input.sources.propertyId, sourceListingId: input.sources.listingId,
    seoTitle: input.seoTitle, seoDescription: input.seoDescription, designStyle: input.designStyle, kind: sql.PageVersionKind[input.kind],
    structuredPageData: JSON.stringify(input.data), validation: input.validation,
  }, request.options), "CreateWebsitePage");
}

export async function saveVersion(context: Context, page: StoredPage["page"], input: PageFields & {kind: "EDITED" | "RESTORED"; expectedRevision: number; data: PageData; validation: string | null}) {
  const {request, organizationId} = context;
  const versionNumber = page.versionCount + 1;
  await executeWorkspaceOperation(() => sql.saveWebsitePageVersion(request.dc, scoped({
    organizationId, id: page.id, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, versionNumber, kind: sql.PageVersionKind[input.kind],
    title: input.title, slug: input.slug, description: input.description, seoTitle: input.seoTitle, seoDescription: input.seoDescription, designStyle: input.designStyle,
    structuredPageData: JSON.stringify(input.data), validation: input.validation,
  }, writeScope(context)), request.options), "SaveWebsitePageVersion");
  return {versionNumber, revision: input.expectedRevision + 1};
}

/** Server-only write of a generated page (NO_ACCESS; the actor's membership and role are re-checked in the database). */
export async function createGeneratedPage(context: Context, input: PageFields & {id: string; websiteId: string; data: PageData; validation: string; model: string; sources: {projectId: string | null; propertyId: string | null; listingId: string | null}}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.createGeneratedWebsitePage(request.dc, {
    organizationId, id: input.id, actorUid: request.user.uid, websiteId: input.websiteId, title: input.title, slug: input.slug, description: input.description,
    sourceProjectId: input.sources.projectId, sourcePropertyId: input.sources.propertyId, sourceListingId: input.sources.listingId,
    seoTitle: input.seoTitle, seoDescription: input.seoDescription, designStyle: input.designStyle, structuredPageData: JSON.stringify(input.data), validation: input.validation, model: input.model,
  }), "CreateGeneratedWebsitePage");
}

export async function addGeneratedVersion(context: Context, page: StoredPage["page"], input: {expectedRevision: number; title: string; seoTitle: string | null; seoDescription: string | null; designStyle: string; data: PageData; validation: string; model: string}) {
  const {request, organizationId} = context;
  const versionNumber = page.versionCount + 1;
  await executeWorkspaceOperation(() => sql.addGeneratedPageVersion(request.dc, scoped({
    organizationId, id: page.id, actorUid: request.user.uid, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, versionNumber,
    title: input.title, seoTitle: input.seoTitle, seoDescription: input.seoDescription, designStyle: input.designStyle,
    structuredPageData: JSON.stringify(input.data), validation: input.validation, model: input.model,
  }, writeScope(context))), "AddGeneratedPageVersion");
  return {versionNumber};
}

const transition = {nextRevision: (expected: number) => expected + 1};

export async function submitForReview(context: Context, id: string, expectedRevision: number) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.submitWebsitePageForReview(request.dc, scoped({organizationId, id, expectedRevision, nextRevision: transition.nextRevision(expectedRevision)}, writeScope(context)), request.options), "SubmitWebsitePageForReview");
}

export async function approvePage(context: Context, id: string, versionNumber: number, expectedRevision: number) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.approveWebsitePage(request.dc, {organizationId, id, versionNumber, expectedRevision, nextRevision: transition.nextRevision(expectedRevision)}, request.options), "ApproveWebsitePage");
}

export async function rejectPage(context: Context, id: string, note: string, expectedRevision: number) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.rejectWebsitePage(request.dc, {organizationId, id, note, expectedRevision, nextRevision: transition.nextRevision(expectedRevision)}, request.options), "RejectWebsitePage");
}

export async function unpublishPage(context: Context, id: string, publicationId: string, expectedRevision: number) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.unpublishWebsitePage(request.dc, {organizationId, id, publicationId, expectedRevision, nextRevision: transition.nextRevision(expectedRevision)}, request.options), "UnpublishWebsitePage");
}

export async function archivePage(context: Context, id: string, expectedRevision: number) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.archiveWebsitePage(request.dc, scoped({organizationId, id, expectedRevision, nextRevision: transition.nextRevision(expectedRevision)}, writeScope(context)), request.options), "ArchiveWebsitePage");
}

export async function setFormBinding(context: Context, pageId: string, formId: string | null) {
  const {request, organizationId} = context;
  if (formId) await executeWorkspaceOperation(() => sql.setPageLeadFormBinding(request.dc, {organizationId, pageId, formId}, request.options), "SetPageLeadFormBinding");
  else await executeWorkspaceOperation(() => sql.removePageLeadFormBinding(request.dc, {organizationId, pageId}, request.options), "RemovePageLeadFormBinding");
}

export async function updateWebsiteSettings(context: Context, input: {id: string; name: string; allowAgentDrafts: boolean; defaultStyle: string | null; expectedRevision: number}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.updateWebsiteSettings(request.dc, {
    organizationId, id: input.id, name: input.name, allowAgentDrafts: input.allowAgentDrafts, designSettings: JSON.stringify({defaultStyle: input.defaultStyle}),
    expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1,
  }, request.options), "UpdateWebsiteSettings");
}

/** NO_ACCESS: the publisher's OWNER/ADMIN membership and the version's approval are re-checked in the transaction. */
export async function publishPage(context: Context, input: {pageId: string; publicationId: string; versionId: string; versionNumber: number; pageSlug: string; expectedRevision: number; currentVersionNumber: number; status: PageStatus; snapshot: string; sourceFingerprint: string; checklist: string}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.publishWebsitePage(request.dc, {
    organizationId, pageId: input.pageId, actorUid: request.user.uid, publicationId: input.publicationId, versionId: input.versionId, versionNumber: input.versionNumber,
    pageSlug: input.pageSlug, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, currentVersionNumber: input.currentVersionNumber,
    status: sql.WebsitePageStatus[input.status], snapshot: input.snapshot,
    sourceFingerprint: input.sourceFingerprint, checklist: input.checklist,
  }), "PublishWebsitePage");
}

export async function listEnquiries(context: Context, pageId: string) {
  const {request, organizationId} = context;
  const [enquiries, pending] = await Promise.all([
    executeWorkspaceOperation(() => sql.listWebsitePageEnquiries(request.dc, {organizationId, pageId, limit: 50}, request.options), "ListWebsitePageEnquiries"),
    executeWorkspaceOperation(() => sql.listPendingWebsiteEnquiries(request.dc, {organizationId, pageId, limit: 50}, request.options), "ListPendingWebsiteEnquiries"),
  ]);
  return {
    enquiries: enquiries.enquiries.map(row => ({
      id: canonicalUuid(row.id), leadId: canonicalUuid(row.leadId), createdAt: row.createdAt, utmSource: row.utmSource ?? null, utmMedium: row.utmMedium ?? null, utmCampaign: row.utmCampaign ?? null,
      lead: {fullName: row.lead.fullName, status: row.lead.status, archived: Boolean(row.lead.archivedAt)},
    })),
    total: enquiries.total[0]?.count ?? 0,
    pending: pending.pending.map(row => pendingView(row)),
    pendingTotal: pending.total[0]?.count ?? 0,
  };
}

export async function listAllPending(context: Context) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listPendingWebsiteEnquiries(request.dc, {organizationId, limit: 50}, request.options), "ListPendingWebsiteEnquiries");
  return {pending: data.pending.map(pendingView), total: data.total[0]?.count ?? 0, raw: data.pending};
}

function pendingView(row: {id: string; pageId?: string | null; errorCode: string; attempts: number; createdAt: string; payload: string}) {
  let name = "Website visitor";
  try { const payload = JSON.parse(row.payload) as {fullName?: unknown}; if (typeof payload.fullName === "string") name = payload.fullName.slice(0, 160); } catch { /* payload is validated on write */ }
  return {id: canonicalUuid(row.id), pageId: row.pageId ? canonicalUuid(row.pageId) : null, errorCode: row.errorCode, attempts: row.attempts, createdAt: row.createdAt, name};
}

export async function dismissPending(context: Context, id: string) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.dismissPendingWebsiteEnquiry(request.dc, {organizationId, id}, request.options), "DismissPendingWebsiteEnquiry");
}
