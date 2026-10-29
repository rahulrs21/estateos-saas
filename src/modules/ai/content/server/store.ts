import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { escapeLikeSearch } from "../../policy";
import { type ContentLanguage, type ContentType, type DraftStatus } from "../catalog";
import { presentBranding } from "../facts";
import type { brandProfileSchema, draftListSchema, templateInputSchema } from "../policy";
import { parseGenerationSettings, statusesForView, type GenerationSettings } from "../policy";
import { parseContentData, type ContentData } from "../schemas";
import { parseValidation, type DraftValidation } from "../validate";
import type { z } from "zod";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Draft scope: owners and administrators manage company-wide content; every
 * other member works only with drafts they created. The scope is passed to
 * the stored operations as createdByUid, and the operations re-check it
 * against the caller's membership, so the rule holds even if this module is
 * bypassed. Generated content is written by NO_ACCESS operations only after
 * the server has verified the session and every source record.
 */

export const isAdministrator = (context: Context) => context.membership.role === "OWNER" || context.membership.role === "ADMIN";

/** undefined = company-wide (administrators only); otherwise the caller's uid. */
export function draftScope(context: Context, scope: "MINE" | "COMPANY" = "COMPANY") {
  return isAdministrator(context) && scope === "COMPANY" ? undefined : context.request.user.uid;
}

// --- Brand ------------------------------------------------------------------

export async function getBrand(context: Context) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getAiBrandProfile(request.dc, {organizationId}, request.options), "GetAiBrandProfile");
  const organization = data.organization ?? {name: context.organization.name, contactPhone: null, companyEmail: null};
  const profile = data.profile ?? null;
  return {
    organization: {name: organization.name, contactPhone: organization.contactPhone ?? null, companyEmail: organization.companyEmail ?? null},
    profile: profile ? {...profile, updatedBy: profile.updatedBy?.displayName ?? null} : null,
    approved: presentBranding({companyName: organization.name, companyPhone: organization.contactPhone, companyEmail: organization.companyEmail, profile}),
  };
}

export async function saveBrand(context: Context, input: z.infer<typeof brandProfileSchema>) {
  const {request, organizationId} = context;
  const fields = {
    displayName: input.displayName ?? null, logoReference: input.logoReference ?? null, brandTone: input.brandTone ?? null,
    preferredLanguage: sql.AiContentLanguage[input.preferredLanguage], useCompanyPhone: input.useCompanyPhone, useCompanyEmail: input.useCompanyEmail,
    website: input.website ?? null, whatsappNumber: input.whatsappNumber ?? null, defaultCallToAction: input.defaultCallToAction ?? null,
    tagline: input.tagline ?? null, marketingDisclaimer: input.marketingDisclaimer ?? null,
  };
  if (input.expectedRevision === 0) {
    await executeWorkspaceOperation(() => sql.createAiBrandProfile(request.dc, {organizationId, ...fields}, request.options), "CreateAiBrandProfile")
      .catch(error => { throw error instanceof WorkspaceError && error.code === "CONFLICT" ? changed() : error; });
  } else {
    await executeWorkspaceOperation(() => sql.updateAiBrandProfile(request.dc, {organizationId, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, ...fields}, request.options), "UpdateAiBrandProfile");
  }
  return getBrand(context);
}

const changed = () => new WorkspaceError("CONFLICT", 409, "These settings were changed by someone else. Reload and try again.");

// --- Templates --------------------------------------------------------------

export async function listTemplates(context: Context, options: {includeInactive: boolean; contentType?: ContentType}) {
  const {request, organizationId} = context;
  const includeInactive = options.includeInactive && isAdministrator(context);
  const data = await executeWorkspaceOperation(() => sql.listAiContentTemplates(request.dc, {
    organizationId, contentType: options.contentType ? sql.AiContentType[options.contentType] : undefined, isActive: includeInactive ? undefined : true, limit: 200,
  }, request.options), "ListAiContentTemplates");
  return data.templates.map(row => ({...row, id: canonicalUuid(row.id), updatedBy: row.updatedBy?.displayName ?? null}));
}

export async function getActiveTemplate(context: Context, id: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getAiContentTemplate(request.dc, {organizationId, id}, request.options), "GetAiContentTemplate");
  if (!data.template) throw new WorkspaceError("NOT_FOUND", 404, "This template is unavailable. Choose another template.");
  return data.template;
}

type TemplateInput = z.infer<typeof templateInputSchema>;
const templateFields = (input: TemplateInput) => ({
  name: input.name, contentType: sql.AiContentType[input.contentType], purpose: input.purpose ?? null, instructions: input.instructions,
  tone: input.tone ?? null, language: input.language ? sql.AiContentLanguage[input.language] : null, isActive: input.isActive,
});

export async function createTemplate(context: Context, input: TemplateInput) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.createAiContentTemplate(request.dc, {organizationId, ...templateFields(input)}, request.options), "CreateAiContentTemplate");
  return {id: canonicalUuid(data.template.id)};
}

export async function updateTemplate(context: Context, id: string, input: TemplateInput & {expectedRevision: number}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.updateAiContentTemplate(request.dc, {organizationId, id, expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1, ...templateFields(input)}, request.options), "UpdateAiContentTemplate");
  return {id};
}

export async function deleteTemplate(context: Context, id: string) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.deleteAiContentTemplate(request.dc, {organizationId, id}, request.options), "DeleteAiContentTemplate");
  return {id, deleted: true};
}

// --- Drafts -----------------------------------------------------------------

export async function listDrafts(context: Context, input: z.infer<typeof draftListSchema>) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.listAiContentDrafts(request.dc, {
    organizationId, createdByUid: draftScope(context, input.scope),
    statuses: statusesForView(input.view).map(status => sql.AiContentDraftStatus[status]),
    contentType: input.contentType ? sql.AiContentType[input.contentType] : undefined,
    search: escapeLikeSearch(input.search), limit: input.limit, offset: input.offset,
  }, request.options), "ListAiContentDrafts");
  const total = data.total[0]?.count ?? 0;
  return {
    drafts: data.drafts.map(row => ({
      ...row, id: canonicalUuid(row.id), createdBy: row.createdBy?.displayName ?? null, isMine: row.createdByUid === request.user.uid,
      sourceProjectId: row.sourceProjectId ? canonicalUuid(row.sourceProjectId) : null, sourcePropertyId: row.sourcePropertyId ? canonicalUuid(row.sourcePropertyId) : null,
      sourceListingId: row.sourceListingId ? canonicalUuid(row.sourceListingId) : null, sourceLeadId: row.sourceLeadId ? canonicalUuid(row.sourceLeadId) : null,
    })),
    total, limit: input.limit, offset: input.offset, hasNext: input.offset + input.limit < total, canViewCompany: isAdministrator(context),
  };
}

export interface StoredDraft {
  id: string; title: string; contentType: ContentType; purpose: string; language: ContentLanguage; tone: string; audience: string; status: DraftStatus;
  sourceProjectId: string | null; sourcePropertyId: string | null; sourceListingId: string | null; sourceLeadId: string | null;
  settings: GenerationSettings; templateId: string | null; contentData: ContentData; validation: DraftValidation;
  model: string | null; generatedAt: string; revision: number; versionCount: number; createdAt: string; updatedAt: string;
  createdBy: string | null; updatedBy: string | null; isMine: boolean;
}

const optionalId = (value: string | null | undefined) => value ? canonicalUuid(value) : null;

export async function getDraft(context: Context, id: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getAiContentDraft(request.dc, {organizationId, id, createdByUid: draftScope(context)}, request.options), "GetAiContentDraft");
  const row = data.draft;
  if (!row) throw new WorkspaceError("NOT_FOUND", 404, "This draft was not found.");
  const type = row.contentType as ContentType;
  const language = row.language as ContentLanguage;
  const contentData = parseContentData(type, language, row.contentData);
  const validation = parseValidation(row.validation);
  const settings = parseGenerationSettings(row.sourceRefs);
  if (!contentData || !validation || !settings) throw new WorkspaceError("DRAFT_UNREADABLE", 409, "This draft could not be read. Restore an earlier version or create a new draft.");
  const draft: StoredDraft = {
    id: canonicalUuid(row.id), title: row.title, contentType: type, purpose: row.purpose, language, tone: row.tone, audience: row.audience, status: row.status as DraftStatus,
    sourceProjectId: optionalId(row.sourceProjectId), sourcePropertyId: optionalId(row.sourcePropertyId), sourceListingId: optionalId(row.sourceListingId), sourceLeadId: optionalId(row.sourceLeadId),
    settings,
    templateId: optionalId(row.templateId), contentData, validation, model: row.model ?? null, generatedAt: row.generatedAt, revision: row.revision, versionCount: row.versionCount,
    createdAt: row.createdAt, updatedAt: row.updatedAt, createdBy: row.createdBy?.displayName ?? null, updatedBy: row.updatedBy?.displayName ?? null,
    isMine: row.createdByUid === request.user.uid,
  };
  return {
    draft,
    versions: data.versions.map(version => ({...version, id: canonicalUuid(version.id), createdBy: version.createdBy?.displayName ?? null})),
  };
}

export async function getVersion(context: Context, draftId: string, versionNumber: number) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getAiContentVersion(request.dc, {organizationId, draftId, versionNumber, createdByUid: draftScope(context)}, request.options), "GetAiContentVersion");
  if (!data.version) throw new WorkspaceError("NOT_FOUND", 404, "This version was not found.");
  return data.version;
}

export async function saveDraft(context: Context, draft: StoredDraft, input: {expectedRevision: number; kind: "EDITED" | "RESTORED"; status: "DRAFT" | "IN_REVIEW"; title: string; contentData: string; validation: string}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.saveAiContentDraft(request.dc, {
    organizationId, id: draft.id, createdByUid: draftScope(context), expectedRevision: input.expectedRevision, nextRevision: input.expectedRevision + 1,
    versionNumber: draft.versionCount + 1, kind: sql.AiContentVersionKind[input.kind], status: sql.AiContentDraftStatus[input.status],
    title: input.title, contentData: input.contentData, validation: input.validation,
  }, request.options), "SaveAiContentDraft");
}

export async function setDraftStatus(context: Context, id: string, expectedRevision: number, status: DraftStatus) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.setAiContentDraftStatus(request.dc, {
    organizationId, id, createdByUid: draftScope(context), expectedRevision, nextRevision: expectedRevision + 1, status: sql.AiContentDraftStatus[status],
  }, request.options), "SetAiContentDraftStatus");
}

export async function deleteDraft(context: Context, id: string) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.deleteAiContentDraft(request.dc, {organizationId, id, createdByUid: draftScope(context)}, request.options), "DeleteAiContentDraft");
  return {id, deleted: true};
}

// --- Generated content (server-only operations) ------------------------------

export interface GeneratedDraftInput {
  title: string; contentData: string; validation: string; sourceRefs: string; model: string; generatedAt: string;
}

export async function createGeneratedDraft(context: Context, input: GeneratedDraftInput & {
  id: string; contentType: ContentType; purpose: string; language: ContentLanguage; tone: string; audience: string;
  sourceProjectId?: string; sourcePropertyId?: string; sourceListingId?: string; sourceLeadId?: string; templateId?: string;
}) {
  const {request, organizationId} = context;
  await executeWorkspaceOperation(() => sql.createAiContentDraft(request.dc, {
    organizationId, id: input.id, actorUid: request.user.uid, contentType: sql.AiContentType[input.contentType], purpose: input.purpose, title: input.title,
    language: sql.AiContentLanguage[input.language], tone: input.tone, audience: input.audience,
    sourceProjectId: input.sourceProjectId ?? null, sourcePropertyId: input.sourcePropertyId ?? null, sourceListingId: input.sourceListingId ?? null,
    sourceLeadId: input.sourceLeadId ?? null, sourceRefs: input.sourceRefs, templateId: input.templateId ?? null,
    contentData: input.contentData, validation: input.validation, model: input.model, generatedAt: input.generatedAt,
  }), "CreateAiContentDraft");
}

export async function addGeneratedVersion(context: Context, draft: StoredDraft, mode: "REGENERATE" | "ALTERNATIVE", expectedRevision: number, input: GeneratedDraftInput) {
  const {request, organizationId} = context;
  const common = {
    organizationId, id: draft.id, actorUid: request.user.uid, createdByUid: draftScope(context), expectedRevision, nextRevision: expectedRevision + 1,
    versionNumber: draft.versionCount + 1, title: input.title, contentData: input.contentData, validation: input.validation, model: input.model, generatedAt: input.generatedAt,
  };
  if (mode === "REGENERATE") {
    await executeWorkspaceOperation(() => sql.regenerateAiContentDraft(request.dc, {...common, sourceRefs: input.sourceRefs}), "RegenerateAiContentDraft");
  } else {
    await executeWorkspaceOperation(() => sql.addAiContentAlternative(request.dc, common), "AddAiContentAlternative");
  }
  return {versionNumber: draft.versionCount + 1};
}
