import "server-only";

import { classifyGraphError, isMetaId, parseQuestions, type GraphFailure, type MetaLead, type MetaQuestion } from "../meta";

/*
 * The Meta Graph API for Lead Ads, server only (docs/META_LEAD_ADS_PLAN.md).
 * A Page access token is passed in the Authorization header, never in a URL (URLs end up in logs),
 * and is never logged or returned. Tests may point the base at a local fake server; nothing else is accepted.
 */

const DEFAULT_VERSION = "v27.0";
const TIMEOUT_MS = 15_000;
const LEAD_FIELDS = "id,created_time,field_data,form_id,ad_id,adset_id,campaign_id,platform,is_organic,custom_disclaimer_responses";

export function metaGraphBase() {
  const override = process.env.META_GRAPH_BASE?.trim();
  if (override && process.env.NODE_ENV !== "production" && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(override)) return override;
  return "https://graph.facebook.com";
}
export function metaGraphVersion() {
  const value = (process.env.META_GRAPH_VERSION ?? process.env.INBOX_WHATSAPP_GRAPH_VERSION)?.trim();
  return value && /^v\d{1,3}\.\d$/.test(value) ? value : DEFAULT_VERSION;
}

/** A Graph API call that did not succeed: what to do about it, and a short code for logs (no message from Meta). */
export class MetaGraphError extends Error {
  constructor(readonly failure: GraphFailure, readonly code: string) { super(code); }
}

async function graphGet<T>(path: string, fields: string, token: string, extra: Record<string, string> = {}): Promise<T> {
  const url = `${metaGraphBase()}/${metaGraphVersion()}/${path}?${new URLSearchParams({fields, ...extra})}`;
  let response: Response;
  try {
    response = await fetch(url, {headers: {Authorization: `Bearer ${token}`}, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS)});
  } catch {
    throw new MetaGraphError("RETRY", "META_UNREACHABLE");
  }
  const body = await response.json().catch(() => null) as (T & {error?: {code?: unknown; error_subcode?: unknown}}) | null;
  if (!response.ok || !body || body.error) {
    const failure = classifyGraphError(response.status, body?.error);
    const code = typeof body?.error?.code === "number" ? `META_${body.error.code}` : `META_HTTP_${response.status}`;
    throw new MetaGraphError(failure, code.slice(0, 64));
  }
  return body;
}

/** One lead's answers and ad IDs. Needs the leads_retrieval permission on the Page's token. */
export async function fetchMetaLead(leadgenId: string, pageToken: string): Promise<MetaLead> {
  if (!isMetaId(leadgenId)) throw new MetaGraphError("GIVE_UP", "META_LEAD_ID_INVALID");
  const lead = await graphGet<MetaLead>(leadgenId, LEAD_FIELDS, pageToken);
  if (lead.id !== leadgenId) throw new MetaGraphError("GIVE_UP", "META_LEAD_MISMATCH");
  return lead;
}

/** A form's name and questions (used to label answers). Best effort: a form we cannot read still imports leads. */
export async function fetchMetaForm(formId: string, pageToken: string): Promise<{name: string | null; questions: MetaQuestion[]}> {
  if (!isMetaId(formId)) return {name: null, questions: []};
  try {
    const form = await graphGet<{name?: unknown; questions?: unknown}>(formId, "name,questions", pageToken);
    return {name: typeof form.name === "string" && form.name.trim() ? form.name.trim().slice(0, 200) : null, questions: parseQuestions(form.questions)};
  } catch {
    return {name: null, questions: []};
  }
}

// ---------------------------------------------------------------- Phase 7D.2: connecting Pages and reading forms

const TOKEN = /^[A-Za-z0-9._|-]{40,2048}$/;

async function graphSend<T>(method: "POST" | "DELETE", path: string, token: string, form: Record<string, string>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${metaGraphBase()}/${metaGraphVersion()}/${path}`, {
      method, headers: {Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams(form).toString(),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new MetaGraphError("RETRY", "META_UNREACHABLE");
  }
  const body = await response.json().catch(() => null) as (T & {error?: {code?: unknown; error_subcode?: unknown}}) | null;
  if (!response.ok || !body || body.error) {
    const code = typeof body?.error?.code === "number" ? `META_${body.error.code}` : `META_HTTP_${response.status}`;
    throw new MetaGraphError(classifyGraphError(response.status, body?.error), code.slice(0, 64));
  }
  return body;
}

/** Facebook's own sign-in returns a one-time code; the server swaps it for the person's token with EstateOS's app secret. */
async function accessToken(query: Record<string, string>) {
  let response: Response;
  try {
    // Meta's documented token endpoint takes these as query parameters; the URL is never logged.
    response = await fetch(`${metaGraphBase()}/${metaGraphVersion()}/oauth/access_token?${new URLSearchParams(query)}`, {cache: "no-store", redirect: "error", signal: AbortSignal.timeout(TIMEOUT_MS)});
  } catch {
    throw new MetaGraphError("RETRY", "META_UNREACHABLE");
  }
  const body = await response.json().catch(() => null) as {access_token?: unknown; error?: {code?: unknown}} | null;
  const token = typeof body?.access_token === "string" ? body.access_token : "";
  if (!response.ok || !TOKEN.test(token)) {
    throw new MetaGraphError("GIVE_UP", typeof body?.error?.code === "number" ? `META_${body.error.code}` : `META_HTTP_${response.status}`);
  }
  return token;
}

/** The person's long-lived user token (about 60 days) from the sign-in code. Page tokens read with it do not expire. */
export async function exchangeLoginCode(input: {appId: string; appSecret: string; code: string; redirectUri: string}) {
  const shortLived = await accessToken({client_id: input.appId, client_secret: input.appSecret, redirect_uri: input.redirectUri, code: input.code});
  return accessToken({grant_type: "fb_exchange_token", client_id: input.appId, client_secret: input.appSecret, fb_exchange_token: shortLived});
}

export interface MetaPage { id: string; name: string; accessToken: string; tasks: string[] }

/** The Pages the person shared with EstateOS in Facebook's sign-in, with each Page's own token and what the person may do on it. */
export async function listGrantedPages(userToken: string): Promise<MetaPage[]> {
  const body = await graphGet<{data?: unknown}>("me/accounts", "id,name,access_token,tasks", userToken);
  if (!Array.isArray(body.data)) return [];
  return body.data.slice(0, 100).flatMap(item => {
    const {id, name, access_token: token, tasks} = (item ?? {}) as Record<string, unknown>;
    if (!isMetaId(id) || typeof token !== "string" || !TOKEN.test(token)) return [];
    return [{id, name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : `Page ${id}`, accessToken: token,
      tasks: Array.isArray(tasks) ? tasks.filter((task): task is string => typeof task === "string").slice(0, 20) : []}];
  });
}

/** Asks Meta to send the Page's lead notifications to EstateOS (the app's Page webhook). */
export async function subscribePageToLeads(pageId: string, pageToken: string) {
  const body = await graphSend<{success?: unknown}>("POST", `${pageId}/subscribed_apps`, pageToken, {subscribed_fields: "leadgen"});
  if (body.success !== true) throw new MetaGraphError("RETRY", "META_SUBSCRIBE_REFUSED");
}

/** Stops the Page's notifications to EstateOS. Best effort: a Page whose access was already removed is fine. */
export async function unsubscribePage(pageId: string, pageToken: string) {
  try { await graphSend<{success?: unknown}>("DELETE", `${pageId}/subscribed_apps`, pageToken, {}); return true; }
  catch { return false; }
}

export interface MetaFormSummary { id: string; name: string; status: string; questions: MetaQuestion[] }

/** The Page's lead forms (needs pages_manage_ads). */
export async function listPageForms(pageId: string, pageToken: string): Promise<MetaFormSummary[]> {
  const body = await graphGet<{data?: unknown}>(`${pageId}/leadgen_forms`, "id,name,status,questions", pageToken);
  if (!Array.isArray(body.data)) return [];
  return body.data.slice(0, 100).flatMap(item => {
    const {id, name, status, questions} = (item ?? {}) as Record<string, unknown>;
    if (!isMetaId(id)) return [];
    return [{id, name: typeof name === "string" && name.trim() ? name.trim().slice(0, 200) : `Form ${id}`, status: typeof status === "string" ? status : "ACTIVE", questions: parseQuestions(questions)}];
  });
}

/** IDs of a form's leads created after `since` (newest first, at most 100 per check). */
export async function listFormLeadIds(formId: string, pageToken: string, since: Date): Promise<Array<{id: string; createdAt: string | null}>> {
  if (!isMetaId(formId)) return [];
  const filtering = JSON.stringify([{field: "time_created", operator: "GREATER_THAN", value: Math.floor(since.getTime() / 1000)}]);
  const body = await graphGet<{data?: unknown}>(`${formId}/leads`, "id,created_time", pageToken, {filtering, limit: "100"});
  if (!Array.isArray(body.data)) return [];
  return body.data.flatMap(item => {
    const {id, created_time: created} = (item ?? {}) as Record<string, unknown>;
    return isMetaId(id) ? [{id, createdAt: typeof created === "string" && Number.isFinite(Date.parse(created)) ? new Date(created).toISOString() : null}] : [];
  });
}
