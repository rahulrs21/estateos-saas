"use client";

import type { AdPlatform, AdPlatformLimits } from "./ad-limits";
import type { ContentLanguage, ContentType, DraftStatus } from "./catalog";
import { decodeContentEvents, type ContentStreamEvent } from "./protocol";
import type { ContentData } from "./schemas";
import type { SourceRef } from "./facts";
import type { ValidationWarning } from "./validate";

interface ApiError { error?: {code?: string; message?: string} }

export class ContentRequestError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) { super(message); }
}

export type StudioStatus = {role: string; organizationId: string; isAdministrator: boolean; hasInventoryAccess: boolean} & (
  | {enabled: false; code: string; message: string}
  | {enabled: true; model: string; maxInstructionsChars: number; adLimits: Record<AdPlatform, AdPlatformLimits>;
    usage: {period: string; user: {used: number; limit: number}; organization: {used: number; limit: number}}}
);

export interface DraftSummary {
  id: string; title: string; contentType: ContentType; purpose: string; language: ContentLanguage; status: DraftStatus;
  versionCount: number; revision: number; updatedAt: string; generatedAt: string; createdBy: string | null; isMine: boolean;
}

export interface DraftDetail {
  id: string; title: string; contentType: ContentType; purpose: string; language: ContentLanguage; tone: string; audience: string; status: DraftStatus;
  sourceProjectId: string | null; sourcePropertyId: string | null; sourceListingId: string | null; sourceLeadId: string | null;
  settings: {selection: {propertyId?: string; listingId?: string; projectId?: string; leadId?: string; listingIds?: string[]}; useLeadFirstName: boolean; length: string};
  templateId: string | null; contentData: ContentData;
  validation: {generatedAt: string | null; factsReadAt: string | null; model: string | null; sources: SourceRef[]; warnings: ValidationWarning[];
    missingInformation: string[]; claimsToReview: Array<{claim: string; reason: string}>; editedAfterGeneration: boolean};
  model: string | null; generatedAt: string; revision: number; versionCount: number; createdAt: string; updatedAt: string;
  createdBy: string | null; updatedBy: string | null; isMine: boolean; canApprove: boolean;
}

export interface VersionSummary { id: string; versionNumber: number; kind: string; title: string; model: string | null; generatedAt: string | null; createdAt: string; createdBy: string | null }

export interface SourceOption { id: string; label: string; detail: string | null }

export interface BrandSettings {
  organization: {name: string; contactPhone: string | null; companyEmail: string | null};
  profile: null | {displayName?: string | null; logoReference?: string | null; brandTone?: string | null; preferredLanguage: ContentLanguage; useCompanyPhone: boolean; useCompanyEmail: boolean;
    website?: string | null; whatsappNumber?: string | null; defaultCallToAction?: string | null; tagline?: string | null; marketingDisclaimer?: string | null; revision: number; updatedAt: string; updatedBy: string | null};
  canEdit: boolean;
}

export interface ContentTemplate {
  id: string; name: string; contentType: ContentType; purpose?: string | null; instructions: string; tone?: string | null; language?: ContentLanguage | null;
  isActive: boolean; revision: number; updatedAt: string; updatedBy: string | null;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  let body: ApiError & {data?: T} = {};
  try { body = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok || body.data === undefined) throw new ContentRequestError(body.error?.message || fallback, body.error?.code || "REQUEST_FAILED", response.status);
  return body.data;
}

const get = <T,>(path: string, fallback: string) => fetch(path, {credentials: "same-origin", cache: "no-store"}).then(response => readJson<T>(response, fallback));

async function csrfToken() {
  const response = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const body: ApiError & {csrfToken?: string} = await response.json().catch(() => ({}));
  if (!response.ok || !body.csrfToken) throw new ContentRequestError(body.error?.message || "Could not prepare a secure request. Reload and try again.", "CSRF_UNAVAILABLE", response.status);
  return body.csrfToken;
}

async function send<T>(path: string, method: string, organizationId: string, fallback: string, body?: unknown, signal?: AbortSignal) {
  const token = await csrfToken();
  const response = await fetch(path, {
    method, credentials: "same-origin", cache: "no-store", signal,
    headers: {"X-CSRF-Token": token, "X-EstateOS-Organization": organizationId, ...(body === undefined ? {} : {"Content-Type": "application/json"})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {response, read: () => readJson<T>(response, fallback)};
}

export const getStudioStatus = () => get<StudioStatus>("/api/ai/content/status", "The Content Studio status could not be loaded.");

export function listDrafts(input: {search?: string; view?: string; contentType?: string; scope?: "MINE" | "COMPANY"; offset?: number}) {
  const query = new URLSearchParams({limit: "20"});
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.view) query.set("view", input.view);
  if (input.contentType) query.set("contentType", input.contentType);
  if (input.scope) query.set("scope", input.scope);
  if (input.offset) query.set("offset", String(input.offset));
  return get<{drafts: DraftSummary[]; total: number; hasNext: boolean; canViewCompany: boolean}>(`/api/ai/content/drafts?${query}`, "Drafts could not be loaded.");
}

const draftPath = (id: string) => `/api/ai/content/drafts/${encodeURIComponent(id)}`;

export const getDraft = (id: string) => get<{draft: DraftDetail; versions: VersionSummary[]}>(draftPath(id), "This draft could not be loaded.");

export const getVersion = (id: string, versionNumber: number) =>
  get<{version: {versionNumber: number; kind: string; title: string; contentData: ContentData; createdAt: string}}>(`${draftPath(id)}/versions/${versionNumber}`, "This version could not be loaded.");

export async function saveDraft(id: string, organizationId: string, body: {expectedRevision: number; title: string; content: unknown}) {
  return (await send<{draft: DraftDetail; versions: VersionSummary[]}>(draftPath(id), "PATCH", organizationId, "The draft could not be saved.", body)).read();
}

export async function setDraftStatus(id: string, organizationId: string, body: {expectedRevision: number; status: DraftStatus}) {
  return (await send<{draft: DraftDetail; versions: VersionSummary[]}>(`${draftPath(id)}/status`, "POST", organizationId, "The status could not be changed.", body)).read();
}

export async function restoreVersion(id: string, organizationId: string, body: {expectedRevision: number; versionNumber: number}) {
  return (await send<{draft: DraftDetail; versions: VersionSummary[]}>(`${draftPath(id)}/restore`, "POST", organizationId, "The version could not be restored.", body)).read();
}

export async function deleteDraft(id: string, organizationId: string) {
  return (await send<{id: string; deleted: true}>(draftPath(id), "DELETE", organizationId, "The draft could not be deleted.")).read();
}

export function listSourceOptions(kind: "property" | "listing" | "project" | "lead", input: {search?: string; id?: string}) {
  const query = new URLSearchParams({kind});
  if (input.search?.trim()) query.set("search", input.search.trim());
  if (input.id) query.set("id", input.id);
  return get<{options: SourceOption[]}>(`/api/ai/content/sources?${query}`, "Records could not be loaded.");
}

export const getBrandSettings = () => get<BrandSettings & {approved: unknown}>("/api/ai/content/brand", "Brand settings could not be loaded.");

export async function saveBrandSettings(organizationId: string, body: Record<string, unknown>) {
  return (await send<BrandSettings>("/api/ai/content/brand", "PUT", organizationId, "Brand settings could not be saved.", body)).read();
}

export function listTemplates(input: {includeInactive?: boolean; contentType?: string} = {}) {
  const query = new URLSearchParams();
  if (input.includeInactive) query.set("includeInactive", "true");
  if (input.contentType) query.set("contentType", input.contentType);
  return get<{templates: ContentTemplate[]; canEdit: boolean}>(`/api/ai/content/templates?${query}`, "Templates could not be loaded.");
}

export async function createTemplate(organizationId: string, body: Record<string, unknown>) {
  return (await send<{id: string}>("/api/ai/content/templates", "POST", organizationId, "The template could not be created.", body)).read();
}

export async function updateTemplate(id: string, organizationId: string, body: Record<string, unknown>) {
  return (await send<{id: string}>(`/api/ai/content/templates/${encodeURIComponent(id)}`, "PATCH", organizationId, "The template could not be saved.", body)).read();
}

export async function deleteTemplate(id: string, organizationId: string) {
  return (await send<{id: string}>(`/api/ai/content/templates/${encodeURIComponent(id)}`, "DELETE", organizationId, "The template could not be deleted.")).read();
}

/**
 * Start a generation and read the NDJSON progress stream. Errors before the
 * stream starts (session, validation, permissions, rate limit, allowance)
 * are thrown; errors during generation arrive as `error` events.
 */
export async function streamGeneration(input: {path: string; organizationId: string; body: unknown; signal: AbortSignal; onEvent: (event: ContentStreamEvent) => void}) {
  const {response} = await send<never>(input.path, "POST", input.organizationId, "", input.body, input.signal);
  if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("application/x-ndjson")) {
    await readJson(response, "The draft could not be generated. Try again.");
    throw new ContentRequestError("The Content Studio returned an unexpected response.", "UNEXPECTED_RESPONSE", response.status);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let finished = false;
  const handle = (events: ContentStreamEvent[]) => {
    for (const event of events) { if (event.type === "done" || event.type === "error") finished = true; input.onEvent(event); }
  };
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    buffer += value;
    const {events, rest} = decodeContentEvents(buffer);
    buffer = rest;
    handle(events);
  }
  handle(decodeContentEvents(`${buffer}\n`).events);
  if (!finished) throw new ContentRequestError("The connection closed before the draft finished. Check your drafts, then try again.", "STREAM_INTERRUPTED", 0);
}

export const generatePath = "/api/ai/content/generate";
export const regeneratePath = (id: string) => `${draftPath(id)}/generate`;
