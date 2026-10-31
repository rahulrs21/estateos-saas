import "server-only";

import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSession } from "@/lib/auth/session";
import { assertExpectedOrganization, parseWorkspaceJsonRequest } from "@/lib/http/request-policy";
import { authCookies, getAppOrigin } from "@/modules/auth/server/config";
import { authJson } from "@/modules/auth/server/http";
import { validateMutationRequest } from "@/modules/auth/server/request-policy";
import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { validateInput } from "@/modules/organizations/server/validation";
import { pageIdSchema } from "../policy";
import type { RateLimitRule } from "@/lib/rate-limit/limiter";
import { enforceRateLimit, requestClientIp } from "@/lib/rate-limit/server";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { listWebsiteAgents, saveAgentCard } from "./agents";
import { MAX_UPLOAD_BYTES, UPLOAD_TYPES, cleanUploadName, type UploadType } from "../uploads";
import { deleteSectionTemplate, listSectionTemplates, saveSectionTemplate } from "./section-templates";
import { archiveMedia, listMedia, mediaContent, storeUpload, updateMediaAlt } from "./media";
import { generateNewPage, regeneratePage } from "./generate";
import {
  ChecklistBlockedError, approve, archive, bindForm, createPage, dismissPendingEnquiry, editorPayload, pageEnquiries, publish, reject, restorePageVersion,
  retryPending, savePage, saveWebsiteSettings, submitPage, unpublish, websitesOverview,
} from "./service";

/*
 * Website builder endpoints (docs/AI_PAGE_BUILDER.md#api). Reads need a
 * verified session; mutations also need same-origin, the CSRF token and the
 * X-EstateOS-Organization header matching the server-resolved company. The
 * company and role always come from the session, never from the request.
 */

/** Page saves carry the whole page; the stored version is limited to 200,000 characters. */
const PAGE_BODY_BYTES = 256 * 1024;

function logUnexpected(endpoint: string, error: unknown) {
  if (error instanceof WorkspaceError) return;
  const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
  console.error(JSON.stringify({event: "websites.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
}

function errorResponse(endpoint: string, error: unknown) {
  logUnexpected(endpoint, error);
  if (error instanceof ChecklistBlockedError) return authJson({error: {code: error.code, message: error.message, checklist: error.checklist}}, 409);
  return leadErrorResponse(error);
}

async function readContext(request: Request) {
  await authorizeLeadRead(request);
  return requireActiveOrganizationRequest();
}

async function mutationContext(request: Request, maxBytes?: number) {
  validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
  if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const body = await parseWorkspaceJsonRequest(request, maxBytes);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
  return {body, context};
}

const id = (value: string) => validateInput(pageIdSchema, value);

/** Reads are always request-time; connection() stays outside try so prerendering can bail out. */
export async function overviewResponse(request: Request) {
  await connection();
  try { return authJson({data: await websitesOverview(await readContext(request))}); } catch (error) { return errorResponse("overview", error); }
}

export async function settingsResponse(request: Request) {
  try {
    const {body, context} = await mutationContext(request);
    await saveWebsiteSettings(context, body);
    return authJson({data: {saved: true}});
  } catch (error) { return errorResponse("settings", error); }
}

export async function createPageResponse(request: Request) {
  try {
    const {body, context} = await mutationContext(request);
    return authJson({data: await createPage(context, body)}, 201);
  } catch (error) { return errorResponse("create", error); }
}

export async function generatePageResponse(request: Request) {
  try {
    const {body, context} = await mutationContext(request);
    return authJson({data: await generateNewPage(request, context, body)}, 201);
  } catch (error) { return errorResponse("generate", error); }
}

export async function pageResponse(request: Request, pageId: string) {
  await connection();
  try {
    const context = await readContext(request);
    const raw = new URL(request.url).searchParams.get("version");
    const version = raw && /^\d{1,6}$/.test(raw) ? Number(raw) : undefined;
    return authJson({data: await editorPayload(context, id(pageId), version)});
  } catch (error) { return errorResponse("page", error); }
}

export async function savePageResponse(request: Request, pageId: string) {
  try {
    const {body, context} = await mutationContext(request, PAGE_BODY_BYTES);
    return authJson({data: await savePage(context, id(pageId), body)});
  } catch (error) { return errorResponse("save", error); }
}

const ACTIONS = {
  generate: (request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => regeneratePage(request, context, pageId, body),
  restore: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => restorePageVersion(context, pageId, body),
  submit: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => submitPage(context, pageId, body),
  approve: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => approve(context, pageId, body),
  reject: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => reject(context, pageId, body),
  publish: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => publish(context, pageId, body),
  unpublish: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => unpublish(context, pageId, body),
  archive: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => archive(context, pageId, body),
  form: (_request: Request, context: Awaited<ReturnType<typeof requireActiveOrganizationRequest>>, pageId: string, body: unknown) => bindForm(context, pageId, body),
} as const;

export async function pageActionResponse(request: Request, pageId: string, action: string) {
  try {
    if (!Object.hasOwn(ACTIONS, action)) throw new WorkspaceError("NOT_FOUND", 404, "Unknown page action.");
    const {body, context} = await mutationContext(request);
    const result = await ACTIONS[action as keyof typeof ACTIONS](request, context, id(pageId), body);
    return authJson({data: result ?? {done: true}});
  } catch (error) { return errorResponse(action, error); }
}

export async function enquiriesResponse(request: Request, pageId: string) {
  await connection();
  try { return authJson({data: await pageEnquiries(await readContext(request), id(pageId))}); } catch (error) { return errorResponse("enquiries", error); }
}

export async function pendingActionResponse(request: Request, pendingId: string, action: string) {
  try {
    if (action !== "retry" && action !== "dismiss") throw new WorkspaceError("NOT_FOUND", 404, "Unknown action.");
    const {context} = await mutationContext(request);
    const pending = id(pendingId);
    return authJson({data: action === "retry" ? await retryPending(context, pending) : (await dismissPendingEnquiry(context, pending), {done: true})});
  } catch (error) { return errorResponse(`pending.${action}`, error); }
}

export async function agentsResponse(request: Request) {
  await connection();
  try { return authJson({data: await listWebsiteAgents(await readContext(request))}); } catch (error) { return errorResponse("agents", error); }
}

export async function agentCardResponse(request: Request, membershipId: string) {
  try {
    const {body, context} = await mutationContext(request);
    return authJson({data: await saveAgentCard(context, membershipId, body)});
  } catch (error) { return errorResponse("agent-card", error); }
}

// --- Website media library -------------------------------------------------------------

const UPLOAD_RULES = {
  member: {scope: "websites.media.member", limit: 30, windowSeconds: 60},
  ip: {scope: "websites.media.ip", limit: 60, windowSeconds: 60},
  company: {scope: "websites.media.company", limit: 120, windowSeconds: 60},
} satisfies Record<string, RateLimitRule>;

/** Reads at most MAX_UPLOAD_BYTES, stopping as soon as the limit is passed. */
async function readUpload(request: Request) {
  const tooLarge = () => new WorkspaceError("VALIDATION_ERROR", 413, "Images must be 10 MB or smaller.");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_UPLOAD_BYTES)) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose an image to upload.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const {value, done} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_UPLOAD_BYTES) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) throw new WorkspaceError("VALIDATION_ERROR", 400, "The image is empty.");
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total);
}

export async function uploadMediaResponse(request: Request) {
  try {
    validateMutationRequest(request, {origin: getAppOrigin(), csrfToken: (await cookies()).get(authCookies().csrf.name)?.value});
    if (!await getSession()) throw new WorkspaceError("UNAUTHENTICATED", 401, "Sign in to continue.");
    const context = await requireActiveOrganizationRequest();
    assertExpectedOrganization(request.headers.get("x-estateos-organization"), context.organizationId);
    const contentType = request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!Object.hasOwn(UPLOAD_TYPES, contentType)) throw new WorkspaceError("VALIDATION_ERROR", 415, "Upload a JPEG, PNG or WebP image.");
    await enforceRateLimit([
      {rule: UPLOAD_RULES.member, subject: context.membership.id},
      {rule: UPLOAD_RULES.ip, subject: requestClientIp(request) ?? ""},
      {rule: UPLOAD_RULES.company, subject: context.organizationId},
    ], "You are uploading images too quickly. Wait a moment and try again.");
    const bytes = await readUpload(request);
    const type = contentType as UploadType;
    return authJson({data: await storeUpload(context, {bytes, contentType: type, fileName: cleanUploadName(request.headers.get("x-file-name"), type)})}, 201);
  } catch (error) { return errorResponse("media-upload", error); }
}

export async function mediaListResponse(request: Request) {
  await connection();
  try {
    const raw = new URL(request.url).searchParams.get("offset");
    const offset = raw && /^\d{1,4}$/.test(raw) ? Number(raw) : 0;
    return authJson({data: await listMedia(await readContext(request), offset)});
  } catch (error) { return errorResponse("media-list", error); }
}

export async function mediaUpdateResponse(request: Request, mediaId: string) {
  try {
    const {body, context} = await mutationContext(request);
    await updateMediaAlt(context, mediaId, body);
    return authJson({data: {saved: true}});
  } catch (error) { return errorResponse("media-update", error); }
}

export async function mediaArchiveResponse(request: Request, mediaId: string) {
  try {
    const {context} = await mutationContext(request);
    await archiveMedia(context, mediaId);
    return authJson({data: {archived: true}});
  } catch (error) { return errorResponse("media-archive", error); }
}

/** Editor preview of an uploaded image; the company is re-checked on every request. */
export async function mediaContentResponse(request: Request, mediaId: string) {
  await connection();
  try {
    const row = await mediaContent(await readContext(request), mediaId);
    const [bytes] = await getFirebaseAdminStorageBucket().file(row.storagePath).download();
    const body = new Uint8Array(bytes.byteLength);
    body.set(bytes);
    return new Response(body, {headers: {
      "Content-Type": row.contentType, "Content-Length": String(bytes.byteLength), "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox",
    }});
  } catch (error) { return errorResponse("media-content", error); }
}

// --- Saved sections ------------------------------------------------------------------------

/** A saved section can be as large as a page section. */
const TEMPLATE_BODY_BYTES = 96 * 1024;

export async function sectionTemplatesResponse(request: Request) {
  await connection();
  try { return authJson({data: await listSectionTemplates(await readContext(request))}); } catch (error) { return errorResponse("section-templates", error); }
}

export async function saveSectionTemplateResponse(request: Request) {
  try {
    const {body, context} = await mutationContext(request, TEMPLATE_BODY_BYTES);
    return authJson({data: await saveSectionTemplate(context, body)}, 201);
  } catch (error) { return errorResponse("section-template-save", error); }
}

export async function deleteSectionTemplateResponse(request: Request, templateId: string) {
  try {
    const {context} = await mutationContext(request);
    await deleteSectionTemplate(context, templateId);
    return authJson({data: {deleted: true}});
  } catch (error) { return errorResponse("section-template-delete", error); }
}
