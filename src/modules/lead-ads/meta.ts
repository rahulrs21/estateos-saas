import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEmail, normalizePhone } from "../leads/normalization";

/*
 * Meta Lead Ads: the pure parts (docs/META_LEAD_ADS_PLAN.md). No I/O, so every rule here is unit-tested.
 * - Webhook authenticity: X-Hub-Signature-256 is HMAC-SHA256 of the exact raw body with the Meta app secret.
 * - The subscription handshake echoes hub.challenge only for the configured verify token.
 * - Payload parsing keeps only "leadgen" changes with well-formed numeric IDs; anything else is ignored.
 * - A lead's answers become lead fields; every answer is kept, labelled, for the lead page.
 */

const META_ID = /^[0-9]{5,30}$/;
const equalText = (a: string, b: string) => {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
};

export function metaSignature(rawBody: string, appSecret: string) {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

/** Whether Meta signed this exact body with the app secret. */
export function verifyMetaSignature(rawBody: string, header: string | null | undefined, appSecret: string) {
  if (!header || !appSecret) return false;
  return equalText(metaSignature(rawBody, appSecret), header.trim());
}

/** The value to echo for Meta's subscription check, or null to refuse it. */
export function metaHandshake(params: URLSearchParams, verifyToken: string): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge") ?? "";
  if (mode !== "subscribe" || !verifyToken || !equalText(token, verifyToken)) return null;
  return /^[A-Za-z0-9._-]{1,200}$/.test(challenge) ? challenge : null;
}

export interface LeadgenChange {
  pageId: string;
  leadgenId: string;
  formId: string | null;
  adId: string | null;
  adGroupId: string | null;
  createdAt: string | null;
}

export class MetaPayloadError extends Error {}

const optionalId = (value: unknown) => typeof value === "string" && META_ID.test(value) ? value : typeof value === "number" && Number.isSafeInteger(value) && META_ID.test(String(value)) ? String(value) : null;

/** The leadgen notifications in a Page webhook. Throws MetaPayloadError when the body is not a Page webhook at all. */
export function parseLeadgenWebhook(rawBody: string): LeadgenChange[] {
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { throw new MetaPayloadError("NOT_JSON"); }
  if (!body || typeof body !== "object" || (body as {object?: unknown}).object !== "page" || !Array.isArray((body as {entry?: unknown}).entry)) throw new MetaPayloadError("NOT_A_PAGE_WEBHOOK");
  const changes: LeadgenChange[] = [];
  for (const entry of ((body as {entry: unknown[]}).entry).slice(0, 100)) {
    if (!entry || typeof entry !== "object" || !Array.isArray((entry as {changes?: unknown}).changes)) continue;
    for (const change of ((entry as {changes: unknown[]}).changes).slice(0, 100)) {
      if (!change || typeof change !== "object" || (change as {field?: unknown}).field !== "leadgen") continue;
      const value = (change as {value?: Record<string, unknown>}).value ?? {};
      const pageId = optionalId(value.page_id) ?? optionalId((entry as {id?: unknown}).id);
      const leadgenId = optionalId(value.leadgen_id);
      if (!pageId || !leadgenId) continue;
      const created = typeof value.created_time === "number" && Number.isFinite(value.created_time) && value.created_time > 1_000_000_000 && value.created_time < 10_000_000_000
        ? new Date(value.created_time * 1000).toISOString() : null;
      changes.push({pageId, leadgenId, formId: optionalId(value.form_id), adId: optionalId(value.ad_id), adGroupId: optionalId(value.adgroup_id), createdAt: created});
    }
  }
  return changes;
}

/** A lead as the Graph API returns it (GET /{leadgen-id}). */
export interface MetaLead {
  id: string;
  created_time?: string;
  form_id?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  platform?: string;
  is_organic?: boolean;
  field_data?: Array<{name?: unknown; values?: unknown}>;
  custom_disclaimer_responses?: Array<{checkbox_key?: unknown; is_checked?: unknown}>;
}
export interface MetaQuestion { key: string; label: string; type: string }

/** Which custom question fills which lead field (set per form; validated before it is stored). */
export interface MetaFieldMapping {
  propertyInterest?: string;
  preferredLocation?: string;
  propertyType?: string;
  transactionType?: string;
  budget?: string;
  bedroomPreference?: string;
}
export const MAPPABLE_FIELDS = ["propertyInterest", "preferredLocation", "propertyType", "transactionType", "budget", "bedroomPreference"] as const;
/** A field set to this is never filled (not even by a question whose key names it). */
export const NOT_USED = "__none__";
/** Name, email and phone always come from Meta's standard questions; they cannot fill another field. */
const IDENTITY_KEYS = new Set(["full_name", "first_name", "last_name", "email", "work_email", "phone_number", "work_phone_number"]);

/**
 * A mapping an owner chose in settings, checked against the form's own questions: each field is a question of this
 * form (not a name, email or phone question) or NOT_USED; a field left out is detected automatically.
 */
export function validateFieldMapping(input: unknown, questions: MetaQuestion[]): {ok: true; mapping: MetaFieldMapping} | {ok: false; message: string} {
  if (input === null || input === undefined) return {ok: true, mapping: {}};
  if (typeof input !== "object" || Array.isArray(input)) return {ok: false, message: "The question mapping is not valid."};
  const keys = new Set(questions.map(question => question.key));
  const mapping: MetaFieldMapping = {};
  for (const [field, value] of Object.entries(input as Record<string, unknown>)) {
    if (!(MAPPABLE_FIELDS as readonly string[]).includes(field)) return {ok: false, message: "The question mapping names a field EstateOS does not fill."};
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || (value !== NOT_USED && (!keys.has(value) || IDENTITY_KEYS.has(value)))) return {ok: false, message: "Choose one of this form's own questions for each field."};
    mapping[field as keyof MetaFieldMapping] = value;
  }
  return {ok: true, mapping};
}

export function parseFieldMapping(value: unknown): MetaFieldMapping {
  if (!value || typeof value !== "object") return {};
  const mapping: MetaFieldMapping = {};
  for (const field of MAPPABLE_FIELDS) {
    const key = (value as Record<string, unknown>)[field];
    if (typeof key === "string" && /^[A-Za-z0-9_.?'&() -]{1,120}$/.test(key)) mapping[field] = key;
  }
  return mapping;
}

export function parseQuestions(value: unknown): MetaQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 100).flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const {key, label, type} = item as Record<string, unknown>;
    if (typeof key !== "string" || !key || key.length > 120) return [];
    return [{key, label: typeof label === "string" && label.trim() ? label.trim().slice(0, 300) : humanize(key), type: typeof type === "string" ? type.slice(0, 40) : "CUSTOM"}];
  });
}

const clip = (value: string, max: number) => value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
function humanize(key: string) {
  const text = key.replace(/[_?]+/g, " ").replace(/\s+/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : key;
}

/** Each answer as one trimmed string (several values joined), in Meta's order. */
export function answersOf(lead: MetaLead): Array<{key: string; value: string}> {
  return (lead.field_data ?? []).slice(0, 60).flatMap(field => {
    if (typeof field?.name !== "string" || !field.name) return [];
    const values = Array.isArray(field.values) ? field.values.filter((item): item is string => typeof item === "string") : [];
    const value = clip(values.join(", "), 1000);
    return value ? [{key: field.name.slice(0, 120), value}] : [];
  });
}

/** "AED 1.5M - 2M", "800k", "1,200,000" → the bounds in AED (one number is the most they will spend). */
export function parseBudget(text: string): {min: number | null; max: number | null} {
  const numbers = [...text.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)\s*(k|m|mn|million|thousand)?\b/gi)].map(match => {
    const unit = (match[2] ?? "").toLowerCase();
    const factor = unit === "k" || unit === "thousand" ? 1_000 : unit.startsWith("m") ? 1_000_000 : 1;
    return Number(match[1]) * factor;
  }).filter(value => Number.isFinite(value) && value >= 1_000 && value <= 10_000_000_000);
  if (numbers.length === 0) return {min: null, max: null};
  if (numbers.length === 1) return {min: null, max: numbers[0]};
  const [a, b] = numbers;
  return {min: Math.min(a, b), max: Math.max(a, b)};
}

export function parseTransactionType(text: string): "BUY" | "RENT" | "INVEST" | null {
  if (/\brent|lease|tenant/i.test(text)) return "RENT";
  if (/invest|roi|yield/i.test(text)) return "INVEST";
  if (/\bbuy|purchase|own\b|ownership/i.test(text)) return "BUY";
  return null;
}

/** Keys that name a lead field when the form's mapping does not say otherwise. */
const GUESSES: Array<[keyof MetaFieldMapping, RegExp]> = [
  ["budget", /budget|price.?range|how.?much/i],
  ["bedroomPreference", /bed(room)?s?\b|bhk/i],
  ["propertyType", /property.?type|type.?of.?property|unit.?type/i],
  ["transactionType", /buy.?or.?rent|rent.?or.?buy|purpose|looking.?to/i],
  ["preferredLocation", /location|area|community|neighbou?rhood/i],
  ["propertyInterest", /project|interest|looking.?for|requirement/i],
];

export interface MappedLead {
  fullName: string;
  email: string | null;
  phone: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
  propertyInterest: string | null;
  preferredLocation: string | null;
  propertyType: string | null;
  transactionType: "BUY" | "RENT" | "INVEST" | null;
  budgetMin: number | null;
  budgetMax: number | null;
  bedroomPreference: string | null;
  answers: Array<{key: string; label: string; value: string}>;
  consent: Array<{key: string; checked: boolean}>;
}

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,63}$/;
const STANDARD = new Set(["full_name", "first_name", "last_name", "email", "work_email", "phone_number", "work_phone_number"]);

/**
 * A Meta lead's answers as lead fields. Returns null when the person left no email and no phone (a lead
 * needs a way to reach them). Standard questions fill name, email and phone; custom ones fill the
 * mapped fields (or a field their key clearly names); every answer is kept with its label.
 */
export function mapMetaLead(lead: MetaLead, options: {questions?: MetaQuestion[]; mapping?: MetaFieldMapping} = {}): MappedLead | null {
  const answers = answersOf(lead);
  const byKey = new Map(answers.map(answer => [answer.key, answer.value]));
  const labels = new Map((options.questions ?? []).map(question => [question.key, question.label]));
  const first = (...keys: string[]) => keys.map(key => byKey.get(key)).find(Boolean) ?? null;

  const rawEmail = first("email", "work_email");
  const email = rawEmail && EMAIL.test(rawEmail) ? normalizeEmail(rawEmail).slice(0, 254) : null;
  // A number EstateOS cannot normalize is kept only if it fits the phone column (32) and looks like one; the raw
  // answer always stays in the answers (Meta's testing tool, for example, sends placeholder text there).
  const rawPhone = normalizePhone(first("phone_number", "work_phone_number"));
  const phone = rawPhone.normalizedPhone ? rawPhone
    : rawPhone.phone && rawPhone.phone.length <= 32 && /^[+()\d][\d\s().+-]{5,31}$/.test(rawPhone.phone) ? rawPhone : {phone: null, normalizedPhone: null};
  if (!email && !phone.phone) return null;

  const nameParts = [first("first_name"), first("last_name")].filter(Boolean).join(" ");
  let fullName = clip(first("full_name") ?? nameParts, 160);
  if (fullName.length < 2) fullName = email ? clip(email.split("@")[0], 160) : `Meta lead ${lead.id.slice(-4)}`;
  if (fullName.length < 2) fullName = `Meta lead ${lead.id.slice(-4)}`;

  // Explicit mapping first, then a key that clearly names the field, then (for location) the standard "city".
  const custom = answers.filter(answer => !STANDARD.has(answer.key));
  const mapping = options.mapping ?? {};
  const pick = (field: keyof MetaFieldMapping) => {
    const key = mapping[field];
    if (key === NOT_USED) return null;
    if (key) return byKey.get(key) ?? null;
    const guess = GUESSES.find(([name]) => name === field)?.[1];
    const taken = new Set(Object.values(mapping));
    return guess ? custom.find(answer => !taken.has(answer.key) && guess.test(answer.key))?.value ?? null : null;
  };
  const budgetText = pick("budget");
  const budget = budgetText ? parseBudget(budgetText) : {min: null, max: null};
  const transactionText = pick("transactionType");

  return {
    fullName,
    email,
    phone: phone.phone,
    normalizedEmail: email ? email.toLowerCase() : null,
    normalizedPhone: phone.normalizedPhone,
    propertyInterest: pick("propertyInterest")?.slice(0, 500) ?? null,
    preferredLocation: (pick("preferredLocation") ?? first("city"))?.slice(0, 160) ?? null,
    propertyType: pick("propertyType")?.slice(0, 80) ?? null,
    transactionType: transactionText ? parseTransactionType(transactionText) : null,
    budgetMin: budget.min,
    budgetMax: budget.max,
    bedroomPreference: pick("bedroomPreference")?.slice(0, 40) ?? null,
    answers: answers.map(answer => ({...answer, label: labels.get(answer.key) ?? humanize(answer.key)})),
    consent: (lead.custom_disclaimer_responses ?? []).slice(0, 20).flatMap(item => typeof item?.checkbox_key === "string"
      ? [{key: item.checkbox_key.slice(0, 120), checked: item.is_checked === true || item.is_checked === "1" || item.is_checked === 1}] : []),
  };
}

/** What a Graph API failure means for the event: try again later, ask for a new sign-in, or give up. */
export type GraphFailure = "RETRY" | "RECONNECT" | "GIVE_UP";
export function classifyGraphError(status: number, error: {code?: unknown; error_subcode?: unknown} | null | undefined): GraphFailure {
  const code = typeof error?.code === "number" ? error.code : null;
  if (code === 190 || code === 102 || code === 10 || (code !== null && code >= 200 && code < 300)) return "RECONNECT";
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== null && code >= 80000 && code < 80100)) return "RETRY";
  if (status >= 500 || status === 429 || status === 0) return "RETRY";
  if (code === 100) return "GIVE_UP";
  return status >= 400 && status < 500 ? "GIVE_UP" : "RETRY";
}

/** The lead's activity metadata: the answers and where the lead came from (IDs only; names come in 7E). */
export function leadMetadata(input: {lead: MetaLead; mapped: MappedLead; pageId: string; pageName: string; formName: string; origin: string}) {
  const {lead, mapped} = input;
  return {
    schemaVersion: 1,
    source: "META_LEAD_ADS",
    origin: input.origin,
    platform: lead.platform === "ig" ? "instagram" : lead.platform === "fb" ? "facebook" : (typeof lead.platform === "string" ? lead.platform.slice(0, 20) : null),
    isOrganic: lead.is_organic === true,
    leadgenId: lead.id,
    pageId: input.pageId,
    pageName: input.pageName.slice(0, 200),
    formId: lead.form_id ?? null,
    formName: input.formName.slice(0, 200),
    adId: lead.ad_id ?? null,
    adsetId: lead.adset_id ?? null,
    campaignId: lead.campaign_id ?? null,
    metaCreatedAt: lead.created_time ?? null,
    answers: mapped.answers,
    consent: mapped.consent,
  };
}

export const isMetaId = (value: unknown): value is string => typeof value === "string" && META_ID.test(value);
