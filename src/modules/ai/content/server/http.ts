import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { getInventoryRecord, listInventory } from "@/modules/inventory/server/service";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { getLead, listLeads } from "@/modules/leads/server/service";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { aiConfiguration } from "../../server/anthropic";
import { usageSummary } from "../../server/store";
import { cleanText, humanize, presentLocation } from "../../tools/present";
import { listingPrice } from "../../tools/records";
import { DEFAULT_AD_LIMITS } from "../ad-limits";
import { CONTENT_TYPES } from "../catalog";
import {
  allowedStatusChange, brandProfileSchema, logUnexpectedContentError, draftIdSchema, draftListSchema, draftStatusSchema, parseContentInput, restoreVersionSchema, saveDraftSchema,
  statusAfterEdit, templateInputSchema, templateUpdateSchema,
} from "../policy";
import { contentDataZod, type ContentData } from "../schemas";
import { buildValidation, parseValidation, serializeValidation, type DraftValidation } from "../validate";
import {
  createTemplate, deleteDraft, deleteTemplate, getBrand, getDraft, getVersion, isAdministrator, listDrafts, listTemplates, saveBrand, saveDraft, setDraftStatus,
  updateTemplate, type StoredDraft,
} from "./store";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

function queryInput(request: Request) {
  const input: Record<string, string> = {};
  for (const [key, value] of new URL(request.url).searchParams) {
    if (key in input) throw new WorkspaceError("VALIDATION_ERROR", 400, "Each filter must have a single value.");
    input[key] = value;
  }
  return input;
}

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

/** Origin, CSRF, session and the expected-company header for every mutation. */
async function mutationContext(request: Request, withBody = true) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = withBody ? await parseWorkspaceJsonRequest(request) : {};
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

const respond = async (work: () => Promise<unknown>, status = 200) => {
  try { return authJson({data: await work()}, status); } catch (error) { logUnexpectedContentError("api", error); return leadErrorResponse(error); }
};

// --- Studio status ------------------------------------------------------------

/** Configuration, allowance and what this member can do. Never returns secrets. */
export function studioStatusResponse(request: Request) {
  return respond(async () => {
    const context = await readContext(request);
    const config = aiConfiguration();
    const base = {role: context.membership.role, organizationId: context.organizationId, isAdministrator: isAdministrator(context), hasInventoryAccess: context.membership.role !== "MANAGER"};
    if (!config.ok) {
      return {...base, enabled: false, code: config.code,
        message: config.code === "AI_DISABLED" ? "AI features are turned off for this EstateOS environment." : "AI is not configured. Ask an administrator to set the Anthropic settings."};
    }
    return {...base, enabled: true, model: config.config.model, maxInstructionsChars: config.config.contentMaxInstructionsChars,
      adLimits: config.config.adLimits, usage: await usageSummary(context, config.config)};
  });
}

// --- Drafts -----------------------------------------------------------------

function presentDraft(result: Awaited<ReturnType<typeof getDraft>>, context: Context) {
  const {draft, versions} = result;
  // The fact index is an internal check aid; it is not sent to the browser.
  const validation: Partial<DraftValidation> = {...draft.validation};
  delete validation.factIndex;
  return {
    draft: {...draft, validation, canApprove: isAdministrator(context)},
    versions,
  };
}

export function listDraftsResponse(request: Request) {
  return respond(async () => {
    const context = await readContext(request);
    return listDrafts(context, validateInput(draftListSchema, queryInput(request)));
  });
}

export function getDraftResponse(request: Request, rawId: string) {
  return respond(async () => {
    const context = await readContext(request);
    return presentDraft(await getDraft(context, validateInput(draftIdSchema, rawId)), context);
  });
}

export function getVersionResponse(request: Request, rawId: string, rawVersion: string) {
  return respond(async () => {
    const context = await readContext(request);
    const id = validateInput(draftIdSchema, rawId);
    const versionNumber = validateInput(z.coerce.number().int().min(1).max(100_000), rawVersion);
    const {draft} = await getDraft(context, id);
    const version = await getVersion(context, id, versionNumber);
    const content = parseStoredContent(draft, version.contentData);
    const validation = parseValidation(version.validation);
    return {version: {...version, contentData: content, validation: validation ? {...validation, factIndex: undefined} : null}};
  });
}

function parseStoredContent(draft: StoredDraft, raw: string): ContentData {
  try {
    const result = contentDataZod(draft.contentType, draft.language).safeParse(JSON.parse(raw));
    if (result.success) return result.data as ContentData;
  } catch { /* fall through */ }
  throw new WorkspaceError("DRAFT_UNREADABLE", 409, "This version could not be read.");
}

function assertEditable(draft: StoredDraft, expectedRevision: number) {
  if (draft.status === "ARCHIVED") throw new WorkspaceError("VALIDATION_ERROR", 400, "Restore this draft from the archive before editing it.");
  if (draft.revision !== expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This draft was changed in another window or by a colleague. Reload it and try again.");
}

/** Re-runs the deterministic checks on edited text against the facts recorded at generation. */
function revalidate(draft: StoredDraft, content: ContentData, base: DraftValidation) {
  const config = aiConfiguration();
  const adLimits = config.ok ? config.config.adLimits : undefined;
  return buildValidation({
    type: draft.contentType, purpose: draft.purpose, language: draft.language, content: content.content, factIndex: base.factIndex,
    adLimits: adLimits ?? DEFAULT_AD_LIMITS,
    generatedAt: base.generatedAt, factsReadAt: base.factsReadAt, model: base.model, sources: base.sources,
    missingInformation: base.missingInformation, claimsToReview: base.claimsToReview, editedAfterGeneration: true,
  });
}

export function saveDraftResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    const id = validateInput(draftIdSchema, rawId);
    const input = validateInput(saveDraftSchema, body);
    const {draft} = await getDraft(context, id);
    assertEditable(draft, input.expectedRevision);
    const content = parseContentInput(contentDataZod(draft.contentType, draft.language), {schemaVersion: 1, content: input.content}) as ContentData;
    const validation = revalidate(draft, content, draft.validation);
    await saveDraft(context, draft, {expectedRevision: input.expectedRevision, kind: "EDITED", status: statusAfterEdit(draft.status), title: input.title,
      contentData: JSON.stringify(content), validation: serializeValidation(validation)});
    return presentDraft(await getDraft(context, id), context);
  });
}

export function restoreVersionResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    const id = validateInput(draftIdSchema, rawId);
    const input = validateInput(restoreVersionSchema, body);
    const {draft} = await getDraft(context, id);
    assertEditable(draft, input.expectedRevision);
    const version = await getVersion(context, id, input.versionNumber);
    const content = parseStoredContent(draft, version.contentData);
    const validation = revalidate(draft, content, parseValidation(version.validation) ?? draft.validation);
    validation.editedAfterGeneration = version.kind === "EDITED" || version.kind === "RESTORED";
    await saveDraft(context, draft, {expectedRevision: input.expectedRevision, kind: "RESTORED", status: statusAfterEdit(draft.status), title: version.title,
      contentData: JSON.stringify(content), validation: serializeValidation(validation)});
    return presentDraft(await getDraft(context, id), context);
  });
}

export function setDraftStatusResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    const id = validateInput(draftIdSchema, rawId);
    const input = validateInput(draftStatusSchema, body);
    const {draft} = await getDraft(context, id);
    if (input.status === "APPROVED" && !isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can approve drafts.");
    if (draft.revision !== input.expectedRevision) throw new WorkspaceError("CONFLICT", 409, "This draft was changed in another window or by a colleague. Reload it and try again.");
    if (!allowedStatusChange(draft.status, input.status, isAdministrator(context))) throw new WorkspaceError("VALIDATION_ERROR", 400, "This status change is not allowed.");
    await setDraftStatus(context, id, input.expectedRevision, input.status);
    return presentDraft(await getDraft(context, id), context);
  });
}

export function deleteDraftResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {context} = await mutationContext(request, false);
    return deleteDraft(context, validateInput(draftIdSchema, rawId));
  });
}

// --- Brand and templates ---------------------------------------------------

export function getBrandResponse(request: Request) {
  return respond(async () => {
    const context = await readContext(request);
    return {...await getBrand(context), canEdit: isAdministrator(context)};
  });
}

export function saveBrandResponse(request: Request) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    assertOrganizationAdministrator(context.membership);
    const input = parseContentInput(brandProfileSchema, body);
    return {...await saveBrand(context, input), canEdit: true};
  });
}

export function listTemplatesResponse(request: Request) {
  return respond(async () => {
    const context = await readContext(request);
    const input = validateInput(z.strictObject({includeInactive: z.enum(["true", "false"]).optional(), contentType: z.enum(CONTENT_TYPES).optional()}), queryInput(request));
    return {templates: await listTemplates(context, {includeInactive: input.includeInactive === "true", contentType: input.contentType}), canEdit: isAdministrator(context)};
  });
}

export function createTemplateResponse(request: Request) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    assertOrganizationAdministrator(context.membership);
    return createTemplate(context, parseContentInput(templateInputSchema, body));
  }, 201);
}

export function updateTemplateResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {body, context} = await mutationContext(request);
    assertOrganizationAdministrator(context.membership);
    return updateTemplate(context, validateInput(draftIdSchema, rawId), parseContentInput(templateUpdateSchema, body));
  });
}

export function deleteTemplateResponse(request: Request, rawId: string) {
  return respond(async () => {
    const {context} = await mutationContext(request, false);
    assertOrganizationAdministrator(context.membership);
    return deleteTemplate(context, validateInput(draftIdSchema, rawId));
  });
}

// --- Source pickers ---------------------------------------------------------

const sourceQuerySchema = z.strictObject({
  kind: z.enum(["property", "listing", "project", "lead"]),
  search: z.string().trim().max(120).optional(),
  id: draftIdSchema.optional(),
});

export interface SourceOption { id: string; label: string; detail: string | null }

type Row = Record<string, unknown> & {id: string};
const text = (value: unknown, max = 120) => cleanText(typeof value === "string" ? value : null, max);

function propertyOption(row: Row): SourceOption {
  const location = presentLocation(row as Parameters<typeof presentLocation>[0]);
  const bedrooms = typeof row.bedrooms === "number" ? (row.bedrooms === 0 ? "Studio" : `${row.bedrooms} BR`) : null;
  return {id: canonicalUuid(row.id), label: text(row.propertyReference, 80) ?? "Property",
    detail: [humanize(row.propertyType as string), bedrooms, location.community ?? location.city ?? location.emirate, humanize(row.inventoryStatus as string)].filter(Boolean).join(" · ") || null};
}

function listingOption(row: Row): SourceOption {
  const price = listingPrice(row as unknown as Parameters<typeof listingPrice>[0]);
  return {id: canonicalUuid(row.id), label: text(row.listingReference, 80) ?? "Listing",
    detail: [text(row.title, 100), row.listingPurpose === "RENT" ? "Rent" : "Sale", price?.display, humanize(row.listingStatus as string)].filter(Boolean).join(" · ") || null};
}

function projectOption(row: Row): SourceOption {
  const developer = row.developer as {name?: string} | null | undefined;
  return {id: canonicalUuid(row.id), label: text(row.projectName) ?? "Project", detail: [text(developer?.name), humanize(row.projectStatus as string)].filter(Boolean).join(" · ") || null};
}

function leadOption(row: Row): SourceOption {
  return {id: canonicalUuid(row.id), label: text(row.fullName) ?? "Lead", detail: [humanize(row.status as string), humanize(row.transactionType as string), text(row.preferredLocation, 60)].filter(Boolean).join(" · ") || null};
}

/**
 * Options for the studio's record pickers, from the same services and role
 * rules as the CRM lists. With `id`, returns that one record if the caller
 * can see it (used to pre-select records from a CRM page); otherwise 404.
 */
export function sourceOptionsResponse(request: Request) {
  return respond(async () => {
    await readContext(request);
    const input = validateInput(sourceQuerySchema, queryInput(request));
    const search = input.search || undefined;
    const notFound = () => new WorkspaceError("SOURCE_UNAVAILABLE", 404, "This record is unavailable or outside the records you can use.");
    const one = async (load: () => Promise<unknown>, present: (row: Row) => SourceOption) => {
      try {
        const row = await load() as Row | null;
        if (!row) throw notFound();
        return {options: [present(row)]};
      } catch (error) {
        if (error instanceof WorkspaceError && error.status !== 503) throw notFound();
        throw error;
      }
    };
    switch (input.kind) {
      case "property":
        if (input.id) return one(() => getInventoryRecord("properties", {id: input.id}), propertyOption);
        return {options: ((await listInventory("properties", {search, limit: 20, offset: 0}) as unknown as {properties: Row[]}).properties).map(propertyOption)};
      case "listing":
        if (input.id) return one(() => getInventoryRecord("listings", {id: input.id}), listingOption);
        return {options: ((await listInventory("listings", {search, limit: 20, offset: 0}) as unknown as {propertyListings: Row[]}).propertyListings).map(listingOption)};
      case "project":
        if (input.id) return one(() => getInventoryRecord("projects", {id: input.id}), projectOption);
        return {options: ((await listInventory("projects", {search, limit: 20, offset: 0}) as unknown as {projects: Row[]}).projects).map(projectOption)};
      case "lead":
        if (input.id) return one(async () => (await getLead({leadId: input.id}) as unknown as {lead: Row | null}).lead, leadOption);
        return {options: ((await listLeads({search, limit: 20}) as unknown as {leads: Row[]}).leads).map(leadOption)};
    }
  });
}
