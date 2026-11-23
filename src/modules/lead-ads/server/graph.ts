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

async function graphGet<T>(path: string, fields: string, token: string): Promise<T> {
  const url = `${metaGraphBase()}/${metaGraphVersion()}/${path}?fields=${encodeURIComponent(fields)}`;
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
