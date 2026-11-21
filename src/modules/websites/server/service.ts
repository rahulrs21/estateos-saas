import "server-only";

import { createHash, randomUUID } from "node:crypto";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { getAppOrigin } from "@/modules/auth/server/config";
import { getBrand } from "@/modules/ai/content/server/store";
import { getInventoryMediaRecord } from "@/modules/inventory/server/service";
import { listLeadCaptureForms, retryPendingEnquiry } from "@/modules/lead-capture/server/service";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { pageFactWarnings, parsePageValidation, serializePageValidation, type PageValidationRecord } from "../ai";
import { buildChecklist, missingAttestations, type Checklist } from "../checklist";
import { fingerprintSource, linkedDataChanges, publicPageData, sectionImageRefs, unknownImageRefs, uploadIdsOf, uploadUses, usedMediaIds, usedUploadIds, withoutUnknownCrmImages, type LinkedData } from "../linked";
import { isImageUploadType, isVideoUploadType } from "../uploads";
import { stockImage, stockImageUrl } from "../stock";
import {
  approveSchema, createPageSchema, formBindingSchema, publishSchema, rejectSchema, restoreSchema, revisionSchema, savePageSchema, websiteSettingsSchema,
} from "../policy";
import { PageDataError, defaultTheme, isCrmImageRef, isReservedSlug, isStockImageRef, isUploadImageRef, parsePageData, slugify, type PageData } from "../registry";
import { parseSnapshot, publicMediaPath, publicPagePath, type PublishedSnapshot } from "../snapshot";
import { blankPage, pageFromTemplate } from "../templates";
import { presentFormView } from "../types";
import { mediaByIds } from "./media";
import { editorMediaUrl, loadLinkedData, pageRefsOf } from "./sources";
import {
  PAGE_STATUSES, approvePage, archivePage, availableSlug, createPage as storeCreatePage, dismissPending, getPage, getVersion, isAdministrator, listAllPending, listEnquiries, listPages,
  publishPage as storePublish, rejectPage, saveVersion, setFormBinding, slugTaken, submitForReview, unpublishPage, updateWebsiteSettings, type StoredPage,
} from "./store";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

const today = () => new Date().toISOString().slice(0, 10);
export const fingerprint = (linked: LinkedData) => createHash("sha256").update(fingerprintSource(linked)).digest("hex");

function pageDataOrError(raw: unknown): PageData {
  try { return parsePageData(raw); } catch (error) {
    if (error instanceof PageDataError) throw new WorkspaceError("VALIDATION_ERROR", 400, `The page content is invalid: ${error.issues.slice(0, 3).join("; ")}`);
    throw error;
  }
}

function sourcesOf(page: {sourceProjectId: string | null; sourcePropertyId: string | null; sourceListingId: string | null}) {
  return {projectId: page.sourceProjectId, propertyId: page.sourcePropertyId, listingId: page.sourceListingId};
}

function canCreate(context: Context, website: {allowAgentDrafts: boolean}) {
  return context.membership.role !== "AGENT" || website.allowAgentDrafts;
}

function pagePermissions(context: Context, page: StoredPage["page"]) {
  const admin = isAdministrator(context);
  const own = page.createdByUid === context.request.user.uid;
  const role = context.membership.role;
  const canEdit = page.status !== "ARCHIVED" && (admin || (own && (role === "MANAGER" || (role === "AGENT" && page.website.allowAgentDrafts))));
  const live = Boolean(page.livePublicationId);
  return {
    isAdministrator: admin, canEdit, canGenerate: canEdit,
    canSubmit: canEdit && (page.status === "DRAFT" || page.status === "UNPUBLISHED"),
    canApprove: admin && page.status === "IN_REVIEW",
    canReject: (admin || role === "MANAGER") && page.status === "IN_REVIEW",
    canPublish: admin && page.status === "APPROVED",
    canRollback: admin && page.status !== "ARCHIVED",
    canUnpublish: admin && live,
    canArchive: page.status !== "ARCHIVED" && !live && (admin || own),
    canBindForm: admin && page.status !== "ARCHIVED",
    canViewEnquiries: admin,
    canLinkInventory: role !== "MANAGER",
  };
}

// --- Overview ---------------------------------------------------------------------

export async function websitesOverview(context: Context) {
  const data = await listPages(context, PAGE_STATUSES.filter(status => status !== "ARCHIVED"), 100);
  const pending = isAdministrator(context) ? await listAllPending(context).catch(() => null) : null;
  return {
    organization: data.organization, website: data.website, total: data.total,
    pages: data.pages.map(page => ({
      id: page.id, title: page.title, slug: page.slug, status: page.status, designStyle: page.designStyle, updatedAt: page.updatedAt,
      createdBy: page.createdBy.displayName, live: Boolean(page.livePublicationId),
      publicPath: page.livePublicationId && data.organization.slug ? publicPagePath(data.organization.slug, page.slug) : null,
      linked: Boolean(page.sourceProjectId || page.sourcePropertyId || page.sourceListingId),
    })),
    pendingEnquiries: pending ? {total: pending.total, items: pending.pending} : null,
    permissions: {
      canCreate: canCreate(context, data.website), isAdministrator: isAdministrator(context), canLinkInventory: context.membership.role !== "MANAGER",
    },
  };
}

// --- Create ----------------------------------------------------------------------------

/** Blank, template or duplicate. Linked records are re-read with the caller's permissions before anything is stored. */
export async function createPage(context: Context, raw: unknown) {
  const input = validateInput(createPageSchema, raw);
  const overview = await listPages(context, ["DRAFT"], 1);
  if (!canCreate(context, overview.website)) throw new WorkspaceError("FORBIDDEN", 403, "Agents can create pages only when an owner or administrator allows agent drafts.");
  let data: PageData;
  let sources = {projectId: input.projectId ?? null, propertyId: input.propertyId ?? null, listingId: input.listingId ?? null};
  let meta = {description: null as string | null, seoTitle: null as string | null, seoDescription: null as string | null};
  let kind: "CREATED" | "DUPLICATED" = "CREATED";
  if (input.mode === "DUPLICATE") {
    const source = await getPage(context, canonicalUuid(input.sourcePageId!));
    data = (await getVersion(context, source.page.id, source.page.currentVersionNumber)).data;
    sources = sourcesOf(source.page);
    meta = {description: source.page.description ?? null, seoTitle: source.page.seoTitle ?? null, seoDescription: source.page.seoDescription ?? null};
    kind = "DUPLICATED";
  } else {
    data = blankPage(input.style ?? "CONTEMPORARY");
  }
  const brand = await getBrand(context);
  // Authorization of every linked record (and of comparison listings in a duplicated page).
  const linked = await loadLinkedData(context, {...sources, ...pageRefsOf(data)}, {branding: brand.approved, mediaUrl: editorMediaUrl, required: true});
  if (kind === "CREATED") {
    // Templates use the linked records' own photos where there are any, and illustrative stock media otherwise.
    const crmPhotoIds = linked.media.filter(media => media.kind === "PHOTO").sort((a, b) => Number(b.isCover) - Number(a.isCover)).map(media => media.id);
    data = input.mode === "TEMPLATE" ? pageFromTemplate(input.templateKey!, {crmPhotoIds}) : blankPage(input.style ?? "CONTEMPORARY", {crmPhotoIds});
    if (input.style) data = {...data, theme: {...defaultTheme(input.style)}};
  }
  if (kind === "DUPLICATED") {
    // Images the caller cannot use are removed from the copy rather than carried over.
    const known = new Set(linked.media.map(media => media.id));
    data = pageDataOrError(withoutUnknownCrmImages(data, known));
  }
  const requested = input.slug ?? slugify(input.title);
  if (isReservedSlug(requested)) throw new WorkspaceError("VALIDATION_ERROR", 400, "This page address is reserved. Choose another.");
  const slug = input.slug ? (await slugTaken(context, requested) ? null : requested) : await availableSlug(context, requested);
  if (!slug) throw new WorkspaceError("CONFLICT", 409, "Another page already uses this address. Choose another.");
  const id = randomUUID();
  const validation: PageValidationRecord = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), warnings: pageFactWarnings(data, linked, brand.approved, {title: input.title, ...meta}),
    missingInformation: [], claimsToReview: [], removed: [], omitted: [], generated: null,
  };
  await storeCreatePage(context, {
    id, websiteId: overview.website.id, kind, data, validation: serializePageValidation(validation), sources,
    title: input.title, slug, description: meta.description, seoTitle: meta.seoTitle ?? input.title.slice(0, 120), seoDescription: meta.seoDescription, designStyle: data.theme.style,
  });
  return {id, slug};
}

// --- Editor --------------------------------------------------------------------------

async function livePublication(context: Context, stored: StoredPage, current: LinkedData) {
  const live = stored.publications.find(publication => publication.id === stored.page.livePublicationId && publication.status === "ACTIVE");
  if (!live) return null;
  const path = stored.organization.slug ? publicPagePath(stored.organization.slug, live.pageSlug) : null;
  let changes: string[] = [];
  const currentFingerprint = fingerprint(current);
  if (currentFingerprint !== live.sourceFingerprint) {
    // The caller can read this page (checked above), so the server may read its live snapshot for the comparison.
    const data = await executeWorkspaceOperation(() => sql.getPublishedPageAsset(context.request.dc, {publicationId: live.id}), "GetPublishedPageAsset").catch(() => null);
    const snapshot = data?.publication ? parseSnapshot(data.publication.snapshot) : null;
    changes = snapshot ? linkedDataChanges(snapshot.linked, current) : ["The CRM data linked to this page has changed since it was published."];
    if (!changes.length) changes = ["The CRM data linked to this page has changed since it was published."];
  }
  return {publicationId: live.id, versionNumber: live.versionNumber, publishedAt: live.publishedAt, publishedBy: live.publishedBy.displayName, path, outdated: changes.length > 0, changes};
}

export async function editorPayload(context: Context, rawId: string, versionNumber?: number) {
  const id = canonicalUuid(rawId);
  const stored = await getPage(context, id);
  const version = await getVersion(context, id, versionNumber ?? stored.page.currentVersionNumber);
  const brand = await getBrand(context);
  const linked = await loadLinkedData(context, {...sourcesOf(stored.page), ...pageRefsOf(version.data)}, {branding: brand.approved, mediaUrl: editorMediaUrl, required: false});
  const form = stored.binding ? {...stored.binding.form, view: presentFormView(stored.binding.form, stored.binding.form.status)} : null;
  const validation = parsePageValidation(version.validation);
  const checklist = buildChecklist({
    page: {title: stored.page.title, slug: stored.page.slug, seoTitle: stored.page.seoTitle ?? null, seoDescription: stored.page.seoDescription ?? null},
    data: version.data, linked, form: form ? {status: form.status, consentText: form.consentText, privacyPolicyUrl: form.privacyPolicyUrl} : null,
    contentWarnings: validation?.warnings.length ?? 0, today: today(),
  });
  const permissions = pagePermissions(context, stored.page);
  const forms = permissions.canBindForm ? (await listLeadCaptureForms().catch(() => null))?.forms.map(item => ({id: item.id, name: item.name, status: item.status, publicId: item.publicId})) ?? null : null;
  return {
    organization: stored.organization,
    page: {
      id: stored.page.id, title: stored.page.title, slug: stored.page.slug, description: stored.page.description ?? null, status: stored.page.status,
      seoTitle: stored.page.seoTitle ?? null, seoDescription: stored.page.seoDescription ?? null, designStyle: stored.page.designStyle, revision: stored.page.revision,
      currentVersionNumber: stored.page.currentVersionNumber, approvedVersionNumber: stored.page.approvedVersionNumber ?? null, reviewNote: stored.page.reviewNote ?? null,
      sources: sourcesOf(stored.page), createdBy: stored.page.createdBy.displayName, updatedAt: stored.page.updatedAt, website: {id: stored.page.website.id, allowAgentDrafts: stored.page.website.allowAgentDrafts},
    },
    version: {versionNumber: version.versionNumber, kind: version.kind, approved: Boolean(version.approvedAt), model: version.model, createdAt: version.createdAt, current: version.versionNumber === stored.page.currentVersionNumber},
    data: version.data, validation, linked,
    form: form ? {id: form.id, name: form.name, status: form.status, view: form.view} : null,
    forms, checklist, permissions,
    live: await livePublication(context, stored, linked),
    versions: stored.versions.map(item => ({versionNumber: item.versionNumber, kind: item.kind, model: item.model ?? null, approved: Boolean(item.approvedAt), approvedBy: item.approvedBy?.displayName ?? null, createdAt: item.createdAt, createdBy: item.createdBy.displayName})),
    publications: stored.publications.map(item => ({id: item.id, versionNumber: item.versionNumber, status: item.status, publishedAt: item.publishedAt, publishedBy: item.publishedBy.displayName, unpublishedAt: item.unpublishedAt ?? null})),
    enquiryCount: stored.enquiryCount,
    today: today(),
  };
}
export type EditorPayload = Awaited<ReturnType<typeof editorPayload>>;

function imageRefs(data: PageData) {
  return new Set(data.sections.flatMap(section => sectionImageRefs(section)).flatMap(ref => isCrmImageRef(ref) ? [ref.mediaId] : []));
}

/**
 * New website library uploads must be active uploads of this company;
 * archived ones may stay where they already were. An image slot takes an
 * image and a video slot a video.
 */
async function assertUploadsUsable(context: Context, data: PageData, previous: PageData | null) {
  const ids = uploadIdsOf(data);
  if (!ids.length) return;
  const rows = new Map((await mediaByIds(context, ids)).map(row => [row.id, row]));
  const kept = new Set(previous ? uploadIdsOf(previous) : []);
  if (ids.some(id => !rows.has(id) || (rows.get(id)!.status !== "ACTIVE" && !kept.has(id)))) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "An uploaded image or video on this page is no longer in the website library. Choose another one.");
  }
  for (const use of uploadUses(data)) {
    const type = rows.get(use.id)!.contentType;
    if (use.kind === "video" ? !isVideoUploadType(type) : !isImageUploadType(type)) {
      throw new WorkspaceError("VALIDATION_ERROR", 400, use.kind === "video" ? "A video slot on this page holds a file that is not a video. Choose a video." : "An image slot on this page holds a file that is not an image. Choose an image.");
    }
  }
}

export async function savePage(context: Context, rawId: string, raw: unknown) {
  const id = canonicalUuid(rawId);
  const input = validateInput(savePageSchema, raw);
  const data = pageDataOrError(input.data);
  const stored = await getPage(context, id);
  if (stored.page.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This page was changed in another window or by a colleague. Reload it and try again.");
  if (isReservedSlug(input.slug)) throw new WorkspaceError("VALIDATION_ERROR", 400, "This page address is reserved. Choose another.");
  if (input.slug !== stored.page.slug && await slugTaken(context, input.slug, id)) throw new WorkspaceError("CONFLICT", 409, "Another page already uses this address. Choose another.");
  const brand = await getBrand(context);
  const linked = await loadLinkedData(context, {...sourcesOf(stored.page), ...pageRefsOf(data)}, {branding: brand.approved, mediaUrl: editorMediaUrl, required: false});
  // New image references must be approved media of the linked records the editor can see.
  const previousData = (await getVersion(context, id, stored.page.currentVersionNumber)).data;
  const previous = imageRefs(previousData);
  if (unknownImageRefs(data, linked).some(mediaId => !previous.has(mediaId))) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose images from the photos of the page's linked records.");
  await assertUploadsUsable(context, data, previousData);
  const meta = {title: input.title, seoTitle: input.seoTitle, seoDescription: input.seoDescription};
  const validation: PageValidationRecord = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), warnings: pageFactWarnings(data, linked, brand.approved, meta),
    missingInformation: [], claimsToReview: [], removed: [], omitted: [], generated: null,
  };
  const saved = await saveVersion(context, stored.page, {
    kind: "EDITED", expectedRevision: input.expectedRevision, data, validation: serializePageValidation(validation),
    title: input.title, slug: input.slug, description: input.description, seoTitle: input.seoTitle, seoDescription: input.seoDescription, designStyle: data.theme.style,
  });
  return {...saved, warnings: validation.warnings.length};
}

export async function restorePageVersion(context: Context, rawId: string, raw: unknown) {
  const id = canonicalUuid(rawId);
  const input = validateInput(restoreSchema, raw);
  const stored = await getPage(context, id);
  if (stored.page.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This page was changed in another window or by a colleague. Reload it and try again.");
  const version = await getVersion(context, id, input.versionNumber);
  const brand = await getBrand(context);
  const linked = await loadLinkedData(context, {...sourcesOf(stored.page), ...pageRefsOf(version.data)}, {branding: brand.approved, mediaUrl: editorMediaUrl, required: false});
  const page = stored.page;
  const validation: PageValidationRecord = {
    schemaVersion: 1, checkedAt: new Date().toISOString(), warnings: pageFactWarnings(version.data, linked, brand.approved, {title: page.title, seoTitle: page.seoTitle, seoDescription: page.seoDescription}),
    missingInformation: [], claimsToReview: [], removed: [], omitted: [], generated: null,
  };
  return saveVersion(context, page, {
    kind: "RESTORED", expectedRevision: input.expectedRevision, data: version.data, validation: serializePageValidation(validation),
    title: page.title, slug: page.slug, description: page.description ?? null, seoTitle: page.seoTitle ?? null, seoDescription: page.seoDescription ?? null, designStyle: version.data.theme.style,
  });
}

// --- Workflow -------------------------------------------------------------------------

export async function submitPage(context: Context, rawId: string, raw: unknown) {
  const {expectedRevision} = validateInput(revisionSchema, raw);
  await submitForReview(context, canonicalUuid(rawId), expectedRevision);
}

export async function approve(context: Context, rawId: string, raw: unknown) {
  const input = validateInput(approveSchema, raw);
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can approve pages.");
  await approvePage(context, canonicalUuid(rawId), input.versionNumber, input.expectedRevision);
}

export async function reject(context: Context, rawId: string, raw: unknown) {
  const input = validateInput(rejectSchema, raw);
  await rejectPage(context, canonicalUuid(rawId), input.note, input.expectedRevision);
}

export async function archive(context: Context, rawId: string, raw: unknown) {
  const {expectedRevision} = validateInput(revisionSchema, raw);
  await archivePage(context, canonicalUuid(rawId), expectedRevision);
}

export async function unpublish(context: Context, rawId: string, raw: unknown) {
  const {expectedRevision} = validateInput(revisionSchema, raw);
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can unpublish pages.");
  const stored = await getPage(context, canonicalUuid(rawId));
  if (!stored.page.livePublicationId) throw new WorkspaceError("CONFLICT", 409, "This page is not live.");
  await unpublishPage(context, stored.page.id, stored.page.livePublicationId, expectedRevision);
}

export async function bindForm(context: Context, rawId: string, raw: unknown) {
  const {formId} = validateInput(formBindingSchema, raw);
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can connect lead forms.");
  await setFormBinding(context, canonicalUuid(rawId), formId ? canonicalUuid(formId) : null);
}

export async function saveWebsiteSettings(context: Context, raw: unknown) {
  const input = validateInput(websiteSettingsSchema, raw);
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can change website settings.");
  const overview = await listPages(context, ["DRAFT"], 1);
  await updateWebsiteSettings(context, {id: overview.website.id, name: input.name, allowAgentDrafts: input.allowAgentDrafts, defaultStyle: input.defaultStyle, expectedRevision: input.expectedRevision});
}

// --- Publishing -------------------------------------------------------------------------

export class ChecklistBlockedError extends WorkspaceError {
  constructor(readonly checklist: Checklist, message: string) { super("PUBLISH_BLOCKED", 409, message); }
}

/**
 * Publishes an approved version (or republishes an earlier approved version
 * for a rollback). The linked records are re-read with the publisher's
 * permissions, the checklist must have no blocking item, every requested
 * attestation must be confirmed, and the page's images are resolved to their
 * storage objects. The snapshot is then stored by a server-only transaction
 * that re-checks the publisher's role and the version's approval.
 */
export async function publish(context: Context, rawId: string, raw: unknown) {
  const input = validateInput(publishSchema, raw);
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can publish pages.");
  const stored = await getPage(context, canonicalUuid(rawId));
  const page = stored.page;
  if (page.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This page was changed in another window or by a colleague. Reload it and try again.");
  if (page.status === "ARCHIVED") throw new WorkspaceError("CONFLICT", 409, "Archived pages cannot be published.");
  if (!stored.organization.slug) throw new WorkspaceError("DATA_UNAVAILABLE", 503, "The company address could not be read. Try again.");
  // An explicit version republishes an earlier approved version (rollback, or a refresh with current CRM data).
  const rollback = input.versionNumber !== undefined;
  const versionNumber = input.versionNumber ?? page.approvedVersionNumber;
  if (!versionNumber || (!rollback && page.status !== "APPROVED")) throw new WorkspaceError("CONFLICT", 409, "Approve the page before publishing it.");
  const version = await getVersion(context, page.id, versionNumber);
  if (!version.approvedAt) throw new WorkspaceError("CONFLICT", 409, "Only an approved version can be published.");

  const publicationId = randomUUID();
  const brand = await getBrand(context);
  const selection = {...sourcesOf(page), ...pageRefsOf(version.data)};
  const linked = await loadLinkedData(context, selection, {branding: brand.approved, mediaUrl: id => publicMediaPath(publicationId, id), uploadUrl: id => publicMediaPath(publicationId, id), required: true});
  const form = stored.binding?.form ?? null;
  const validation = parsePageValidation(version.validation);
  const checklist = buildChecklist({
    page: {title: page.title, slug: page.slug, seoTitle: page.seoTitle ?? null, seoDescription: page.seoDescription ?? null},
    data: version.data, linked, form: form ? {status: form.status, consentText: form.consentText, privacyPolicyUrl: form.privacyPolicyUrl} : null,
    contentWarnings: validation?.warnings.length ?? 0, today: today(),
  });
  if (checklist.blockers) throw new ChecklistBlockedError(checklist, `${checklist.blockers} checklist item${checklist.blockers === 1 ? "" : "s"} must be resolved before publishing.`);
  const missing = missingAttestations(checklist, input.attestations);
  if (missing.length) throw new ChecklistBlockedError(checklist, "Confirm every publication statement before publishing.");

  // Image allowlist: storage objects for exactly the images the page shows, re-authorized now.
  const assets: PublishedSnapshot["assets"] = {};
  for (const mediaId of usedMediaIds(version.data, linked)) {
    try {
      const {media} = await getInventoryMediaRecord(mediaId);
      if (!/^image\/(jpeg|png|webp)$/.test(media.contentType)) continue;
      assets[canonicalUuid(mediaId)] = {storagePath: media.storagePath, contentType: media.contentType};
    } catch {
      throw new WorkspaceError("CONFLICT", 409, "A photo on this page is no longer available. Choose other photos and try again.");
    }
  }
  // Website library images and videos: stored objects of the uploads on visible sections (archived ones stay valid for an approved version).
  const uploads = new Map((await mediaByIds(context, usedUploadIds(version.data))).map(row => [row.id, row]));
  for (const uploadId of usedUploadIds(version.data)) {
    const row = uploads.get(uploadId);
    if (!row || !(isImageUploadType(row.contentType) || isVideoUploadType(row.contentType))) throw new WorkspaceError("CONFLICT", 409, "An uploaded image or video on this page is no longer available. Choose another one and try again.");
    assets[uploadId] = {storagePath: row.storagePath, contentType: row.contentType};
  }
  const hero = version.data.sections.find(section => section.type === "HERO" && section.visible);
  // Sharing image: the hero photo (CRM, upload or stock), else the first published photo.
  const heroImage = hero?.type === "HERO" ? hero.props.image ?? (hero.style.backgroundType === "IMAGE" ? hero.style.backgroundImage : null) : null;
  const heroAssetId = heroImage && isCrmImageRef(heroImage) ? canonicalUuid(heroImage.mediaId) : heroImage && isUploadImageRef(heroImage) ? canonicalUuid(heroImage.uploadId) : null;
  const ogImageMediaId = heroAssetId && assets[heroAssetId] ? heroAssetId : heroImage ? null : Object.keys(assets).find(assetId => assets[assetId].contentType.startsWith("image/")) ?? null;
  const stockHero = heroImage && isStockImageRef(heroImage) ? stockImage(heroImage.stockId) : null;
  const ogImageUrl = stockHero ? stockImageUrl(stockHero, 1200) : ogImageMediaId ? publicMediaPath(publicationId, ogImageMediaId) : null;
  const snapshot: PublishedSnapshot = {
    schemaVersion: 1, versionNumber, publishedAt: new Date().toISOString(), title: page.title, description: page.description ?? null,
    seoTitle: page.seoTitle ?? null, seoDescription: page.seoDescription ?? null, data: publicPageData(version.data), linked, assets,
    sources: {
      listingIds: [linked.listing?.id, ...linked.comparison.map(item => item.id)].filter((value): value is string => Boolean(value)).map(canonicalUuid),
      projectIds: linked.project ? [canonicalUuid(linked.project.id)] : [], propertyIds: linked.property ? [canonicalUuid(linked.property.id)] : [],
    },
    ogImageMediaId, ogImageUrl,
  };
  const serialized = JSON.stringify(snapshot);
  if (serialized.length > 400_000) throw new WorkspaceError("VALIDATION_ERROR", 400, "This page is too large to publish. Remove some sections or images.");
  const checklistRecord = JSON.stringify({...checklist, attestations: checklist.attestations, confirmed: input.attestations, publishedBy: context.request.user.uid, rollback}).slice(0, 20_000);
  await storePublish(context, {
    pageId: page.id, publicationId, versionId: version.id, versionNumber, pageSlug: page.slug, expectedRevision: input.expectedRevision, currentVersionNumber: page.currentVersionNumber,
    // The page is "published" only when the live version is its current draft; otherwise the draft keeps its status.
    status: versionNumber === page.currentVersionNumber ? "PUBLISHED" : page.status === "UNPUBLISHED" || page.status === "PUBLISHED" ? "DRAFT" : page.status as "DRAFT" | "IN_REVIEW" | "APPROVED",
    snapshot: serialized, sourceFingerprint: fingerprint(linked), checklist: checklistRecord,
  });
  console.info(JSON.stringify({event: "website.page.published", pageId: page.id, publicationId, versionNumber, rollback, sections: version.data.sections.length, images: Object.keys(assets).length}));
  return {publicationId, path: publicPagePath(stored.organization.slug, page.slug), url: `${getAppOrigin()}${publicPagePath(stored.organization.slug, page.slug)}`};
}

// --- Enquiries ----------------------------------------------------------------------------

export async function pageEnquiries(context: Context, rawId: string) {
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can view landing page enquiries.");
  return listEnquiries(context, canonicalUuid(rawId));
}

export async function retryPending(context: Context, rawId: string) {
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can retry enquiries.");
  const id = canonicalUuid(rawId);
  const {raw} = await listAllPending(context);
  const pending = raw.find(row => canonicalUuid(row.id) === id);
  if (!pending) throw new WorkspaceError("NOT_FOUND", 404, "This enquiry was not found or has already been handled.");
  return retryPendingEnquiry({organizationId: context.organizationId, actorUid: context.request.user.uid, pending: {id, formId: pending.formId, idempotencyKeyHash: pending.idempotencyKeyHash, payload: pending.payload}});
}

export async function dismissPendingEnquiry(context: Context, rawId: string) {
  await dismissPending(context, canonicalUuid(rawId));
}
