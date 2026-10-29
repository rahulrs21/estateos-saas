import { z } from "zod";
import type { AdPlatformLimits, AdPlatform } from "./ad-limits";
import { isAdPlatform } from "./ad-limits";
import { CONTENT_CATALOG, localesFor, type ContentLanguage, type ContentLocale, type ContentType } from "./catalog";
import type { ApprovedBranding, SourceRef } from "./facts";
import { contentTexts, type LocalizedContent } from "./schemas";

/**
 * Deterministic fact check for generated and edited drafts
 * (docs/AI_CONTENT_SECURITY.md). It cannot prove copy is true; it flags what
 * a person must check:
 * - numbers (prices, sizes, percentages, years) that do not appear in the
 *   verified facts or approved branding;
 * - phone numbers, email addresses and web addresses that are not approved;
 * - sensitive claims (guarantees, returns, discounts, permits, distances,
 *   scarcity, visas, superlatives) in English and Arabic;
 * - placeholders left for the user and platform length limits.
 * The model's own missing-data and review lists are kept alongside.
 */

export const WARNING_CODES = ["UNVERIFIED_NUMBER", "UNVERIFIED_CONTACT", "SENSITIVE_CLAIM", "LENGTH_LIMIT", "PLACEHOLDER", "MISSING_DATA", "MODEL_REVIEW"] as const;
export type WarningCode = (typeof WARNING_CODES)[number];

export interface ValidationWarning {
  code: WarningCode;
  locale: ContentLocale | null;
  field: string | null;
  text: string;
  message: string;
}

export interface FactIndex { numbers: string[]; contacts: string[]; supportedTerms: string[] }

export interface DraftValidation {
  schemaVersion: 1;
  generatedAt: string | null;
  factsReadAt: string | null;
  model: string | null;
  sources: SourceRef[];
  warnings: ValidationWarning[];
  missingInformation: string[];
  claimsToReview: Array<{claim: string; reason: string}>;
  editedAfterGeneration: boolean;
  factIndex: FactIndex;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

/** Western digits, ASCII separators and lower case, so English and Arabic text compare the same way. */
export function normalizeDigits(text: string) {
  return text
    .replace(ARABIC_DIGITS, digit => String((digit.charCodeAt(0) & 0xf) % 10))
    .replace(/٬/g, ",").replace(/٫/g, ".");
}

const MULTIPLIERS: Record<string, number> = {k: 1e3, thousand: 1e3, "ألف": 1e3, "الف": 1e3, m: 1e6, mn: 1e6, million: 1e6, "مليون": 1e6, bn: 1e9, billion: 1e9, "مليار": 1e9};
const NUMBER = /(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?:\s*(k|m|mn|million|thousand|bn|billion|ألف|الف|مليون|مليار)(?![a-z²]))?/giu;

const canonical = (value: number) => String(Number(value.toFixed(4)));

/** Every number in a text, as canonical strings (multipliers applied). */
export function extractNumbers(text: string): Array<{raw: string; value: string}> {
  const found: Array<{raw: string; value: string}> = [];
  for (const match of normalizeDigits(text).matchAll(NUMBER)) {
    const whole = Number(`${match[1].replaceAll(",", "")}${match[2] ? `.${match[2]}` : ""}`);
    if (!Number.isFinite(whole)) continue;
    const multiplier = match[3] ? MULTIPLIERS[match[3].toLowerCase()] ?? 1 : 1;
    found.push({raw: match[0].trim(), value: canonical(whole * multiplier)});
  }
  return found;
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ae|net|org|io|co|biz|info|me)\b(?:\/[^\s<>"')\]]*)?/gi;
// International (+ or 00) or UAE local (leading 0) numbers; dates such as 2026-11-03 are not phones.
const PHONE = /(?:\+|\b00)\d[\d\s().-]{6,}\d|\b0\d[\d\s().-]{6,}\d/g;
const PLACEHOLDER = /\[[^\]\n]{2,80}\]/g;

const digitsOnly = (value: string) => normalizeDigits(value).replace(/\D/g, "").replace(/^00/, "").replace(/^0(?=[1-9])/, "971");
const trimUrl = (value: string) => value.replace(/[.,;:!?]+$/, "");
const hostOf = (value: string) => value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].replace(/\.$/, "");

interface SensitiveRule { id: string; pattern: RegExp; message: string; alwaysReview: boolean }

export const SENSITIVE_RULES: SensitiveRule[] = [
  {id: "guarantee", alwaysReview: true, message: "Guarantees cannot be supported by CRM data.",
    pattern: /\bguarantee(?:d|s)?\b|مضمون|مضمونة|ضمان|نضمن/giu},
  {id: "returns", alwaysReview: true, message: "Investment returns, yields and appreciation are not verified by EstateOS.",
    pattern: /\b(?:roi|return on investment|rental yields?|yields?|returns?|capital (?:appreciation|growth)|appreciation|passive income)\b|عائد|عوائد|العائد|ارتفاع (?:القيمة|قيمة)|دخل سلبي/giu},
  {id: "proximity", alwaysReview: true, message: "EstateOS has no verified distances, travel times or nearby places.",
    pattern: /\b(?:\d+\s*(?:minutes?|mins?|km|kilomet(?:er|re)s?|miles?)|walking distance|minutes? (?:away|from|drive)|steps (?:away|from)|close to|near(?:by)?|next to|proximity|short drive)\b|دقائق|دقيقة|كيلومتر|بالقرب من|على بعد|قريب من|مسافة/giu},
  {id: "regulatory", alwaysReview: true, message: "Permits, licences and regulatory approvals must match official records before publication.",
    pattern: /\b(?:rera|dld|trakheesi|permit|licen[cs]ed?|regulated|approved by|registered with)\b|ريرا|دائرة الأراضي|تصريح|ترخيص|مرخص/giu},
  {id: "discount", alwaysReview: false, message: "Discounts and offers are not recorded in EstateOS; confirm before use.",
    pattern: /\b(?:discount(?:ed|s)?|special offer|limited[- ]time|promotion(?:al)?|waived?|free (?:dld|registration|service charges?))\b|% off|خصم|خصومات|عرض خاص|لفترة محدودة/giu},
  {id: "scarcity", alwaysReview: false, message: "Availability claims must match current inventory.",
    pattern: /\b(?:only \d+ (?:units?|left)|last (?:few )?units?|selling fast|sold out|limited availability|few units left|high demand)\b|آخر الوحدات|وحدات محدودة|نفدت/giu},
  {id: "visa_tax", alwaysReview: true, message: "Visa and tax statements need professional verification.",
    pattern: /\b(?:golden visa|residency visa|visa eligib\w*|tax[- ]free)\b|التأشيرة الذهبية|الإقامة الذهبية|معفاة? من الضرائب/giu},
  {id: "superlative", alwaysReview: false, message: "Comparative claims cannot be verified from CRM data.",
    pattern: /\bbest(?! (?:regards|wishes))\b|#1\b|\bnumber one\b|\bcheapest\b|\blowest price\b|\bunbeatable\b|الأفضل|الأرخص/giu},
];

/**
 * Keys whose text must not verify figures: metadata about the read, and free-text
 * staff descriptions (untrusted, possibly imported or injected). A figure that
 * appears only in a description is flagged for review.
 */
const NON_FACT_KEYS = new Set(["readAt", "note", "firstNameNote", "staffDescription"]);

function walkStrings(value: unknown, visit: (text: string) => void) {
  if (typeof value === "string") visit(value);
  else if (typeof value === "number" && Number.isFinite(value)) visit(String(value));
  else if (Array.isArray(value)) value.forEach(item => walkStrings(item, visit));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => { if (!NON_FACT_KEYS.has(key)) walkStrings(item, visit); });
}

const MAX_INDEX_NUMBERS = 500;

/** The facts a later edit is checked against: numbers, approved contacts and supported sensitive terms. */
export function buildFactIndex(facts: unknown, branding: ApprovedBranding): FactIndex {
  const numbers = new Set<string>();
  const corpus: string[] = [];
  const add = (text: string) => {
    corpus.push(normalizeDigits(text).toLowerCase());
    for (const number of extractNumbers(text)) if (numbers.size < MAX_INDEX_NUMBERS) numbers.add(number.value);
    // Dates: 2027-12-31 also supports 2027, 12 and 31 on their own.
    for (const match of normalizeDigits(text).matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
      for (const part of match.slice(1)) if (numbers.size < MAX_INDEX_NUMBERS) numbers.add(canonical(Number(part)));
    }
  };
  walkStrings(facts, add);
  walkStrings(branding, add);
  const contacts = new Set<string>();
  const {phone, whatsapp, email, website} = branding.approvedContacts;
  for (const value of [phone, whatsapp]) if (value && digitsOnly(value).length >= 7) contacts.add(`tel:${digitsOnly(value)}`);
  if (email) contacts.add(`email:${email.toLowerCase()}`);
  if (website) contacts.add(`host:${hostOf(website)}`);
  walkStrings(facts, text => {
    for (const match of text.match(URL_PATTERN) ?? []) contacts.add(`host:${hostOf(match)}`);
  });
  const text = corpus.join("\n");
  const supportedTerms = new Set<string>();
  for (const rule of SENSITIVE_RULES) {
    if (rule.alwaysReview) continue;
    for (const match of text.matchAll(rule.pattern)) if (supportedTerms.size < 50) supportedTerms.add(match[0].toLowerCase());
  }
  return {numbers: [...numbers], contacts: [...contacts].slice(0, 40), supportedTerms: [...supportedTerms]};
}

function checkText(text: string, location: {locale: ContentLocale; field: string}, index: FactIndex, numbers: Set<string>, contacts: Set<string>, push: (warning: ValidationWarning) => void, skipNumbers: boolean) {
  let remaining = normalizeDigits(text);
  for (const match of remaining.match(PLACEHOLDER) ?? []) {
    push({code: "PLACEHOLDER", ...location, text: match, message: "Placeholder: fill this in with verified details before use."});
  }
  remaining = remaining.replace(PLACEHOLDER, " ");
  for (const match of remaining.match(EMAIL) ?? []) {
    if (!contacts.has(`email:${match.toLowerCase()}`)) push({code: "UNVERIFIED_CONTACT", ...location, text: match, message: "This email address is not an approved company contact."});
  }
  remaining = remaining.replace(EMAIL, " ");
  for (const match of (remaining.match(URL_PATTERN) ?? []).map(trimUrl)) {
    if (!contacts.has(`host:${hostOf(match)}`)) push({code: "UNVERIFIED_CONTACT", ...location, text: match, message: "This web address is not an approved company or developer website."});
  }
  remaining = remaining.replace(URL_PATTERN, " ");
  for (const match of remaining.match(PHONE) ?? []) {
    const digits = digitsOnly(match);
    if (digits.length < 8) continue;
    if (!contacts.has(`tel:${digits}`)) push({code: "UNVERIFIED_CONTACT", ...location, text: match.trim(), message: "This phone number is not an approved company contact."});
    remaining = remaining.replace(match, " ");
  }
  if (!skipNumbers) {
    const withoutHashtags = remaining.replace(/#[\p{L}\p{N}_]+/gu, " ");
    for (const number of extractNumbers(withoutHashtags)) {
      if (!numbers.has(number.value)) push({code: "UNVERIFIED_NUMBER", ...location, text: number.raw, message: "This figure does not appear in the verified CRM facts."});
    }
  }
  const lower = remaining.toLowerCase();
  for (const rule of SENSITIVE_RULES) {
    for (const match of lower.matchAll(rule.pattern)) {
      const term = match[0].toLowerCase();
      if (!rule.alwaysReview && index.supportedTerms.includes(term)) continue;
      push({code: "SENSITIVE_CLAIM", ...location, text: match[0], message: rule.message});
    }
  }
}

function lengthWarnings(type: ContentType, purpose: string, locale: ContentLocale, content: Record<string, unknown>, adLimits: Record<AdPlatform, AdPlatformLimits>, push: (warning: ValidationWarning) => void) {
  const over = (field: string, value: string, limit: {max: number; kind: string} | null, label: string) => {
    if (!limit || value.length <= limit.max) return;
    push({code: "LENGTH_LIMIT", locale, field, text: value.slice(0, 80), message: `${label} is ${value.length} characters; the ${limit.kind === "hard" ? "platform limit" : "recommended length"} is ${limit.max}.`});
  };
  if (type === "ADVERTISING" && isAdPlatform(purpose)) {
    const limits = adLimits[purpose];
    const variants = Array.isArray(content.variants) ? content.variants as Array<{primaryText: string; headlines: string[]; descriptions: string[]}> : [];
    variants.forEach((variant, index) => {
      const prefix = `variants[${index}]`;
      if (!limits.primaryText && variant.primaryText.trim()) {
        push({code: "LENGTH_LIMIT", locale, field: `${prefix}.primaryText`, text: variant.primaryText.slice(0, 80), message: `${limits.label} ads have no primary text field; this text will not be used.`});
      }
      over(`${prefix}.primaryText`, variant.primaryText, limits.primaryText, "Primary text");
      variant.headlines.forEach((headline, position) => over(`${prefix}.headlines[${position}]`, headline, limits.headline, "Headline"));
      variant.descriptions.forEach((description, position) => over(`${prefix}.descriptions[${position}]`, description, limits.description, "Description"));
      if (!limits.headline && variant.headlines.some(item => item.trim())) {
        push({code: "LENGTH_LIMIT", locale, field: `${prefix}.headlines`, text: "", message: `${limits.label} ads have no headline field; headlines will not be used.`});
      }
    });
  }
  if (type === "SOCIAL_MEDIA") {
    if (typeof content.instagramCaption === "string") over("instagramCaption", content.instagramCaption, {max: 2200, kind: "hard"}, "Instagram caption");
    const hashtags = Array.isArray(content.hashtags) ? content.hashtags : [];
    if (hashtags.length > 30) push({code: "LENGTH_LIMIT", locale, field: "hashtags", text: "", message: `${hashtags.length} hashtags; Instagram allows at most 30.`});
  }
}

const MAX_WARNINGS = 80;

/** Warnings for one draft's content. Numbers in hashtags are not checked. */
export function validateContent(input: {type: ContentType; purpose: string; language: ContentLanguage; content: LocalizedContent; factIndex: FactIndex; adLimits: Record<AdPlatform, AdPlatformLimits>}): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();
  const push = (warning: ValidationWarning) => {
    const key = `${warning.code}|${warning.locale}|${warning.field}|${warning.text.toLowerCase()}`;
    if (seen.has(key) || warnings.length >= MAX_WARNINGS) return;
    seen.add(key);
    warnings.push(warning);
  };
  const numbers = new Set(input.factIndex.numbers);
  const contacts = new Set(input.factIndex.contacts);
  for (const locale of localesFor(input.language)) {
    const content = input.content[locale];
    if (!content) continue;
    for (const item of contentTexts(content)) {
      checkText(item.text, {locale, field: item.path}, input.factIndex, numbers, contacts, push, item.path.startsWith("hashtags"));
    }
    lengthWarnings(input.type, input.purpose, locale, content, input.adLimits, push);
  }
  return warnings;
}

const factIndexSchema = z.object({numbers: z.array(z.string()).max(1000), contacts: z.array(z.string()).max(100), supportedTerms: z.array(z.string()).max(100)});
const sourceRefSchema = z.object({kind: z.enum(["property", "listing", "project", "lead", "developer"]), id: z.string(), reference: z.string().nullable(), updatedAt: z.string().nullable()});
const warningSchema = z.object({code: z.enum(WARNING_CODES), locale: z.enum(["en", "ar"]).nullable(), field: z.string().nullable(), text: z.string(), message: z.string()});

export const draftValidationSchema = z.object({
  schemaVersion: z.literal(1), generatedAt: z.string().nullable(), factsReadAt: z.string().nullable(), model: z.string().nullable(),
  sources: z.array(sourceRefSchema).max(20), warnings: z.array(warningSchema).max(200),
  missingInformation: z.array(z.string()).max(50), claimsToReview: z.array(z.object({claim: z.string(), reason: z.string()})).max(50),
  editedAfterGeneration: z.boolean(), factIndex: factIndexSchema,
});

export function parseValidation(raw: string): DraftValidation | null {
  try {
    const result = draftValidationSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

const VALIDATION_COLUMN_LIMIT = 19_500;

/** JSON for the validation column, trimmed to fit (warnings first, then the number index). */
export function serializeValidation(validation: DraftValidation): string {
  const copy: DraftValidation = structuredClone(validation);
  let json = JSON.stringify(copy);
  while (json.length > VALIDATION_COLUMN_LIMIT && copy.warnings.length > 10) { copy.warnings = copy.warnings.slice(0, Math.floor(copy.warnings.length * 0.7)); json = JSON.stringify(copy); }
  while (json.length > VALIDATION_COLUMN_LIMIT && copy.factIndex.numbers.length > 50) { copy.factIndex.numbers = copy.factIndex.numbers.slice(0, Math.floor(copy.factIndex.numbers.length * 0.7)); json = JSON.stringify(copy); }
  if (json.length > VALIDATION_COLUMN_LIMIT) { copy.missingInformation = copy.missingInformation.slice(0, 10); copy.claimsToReview = copy.claimsToReview.slice(0, 10); json = JSON.stringify(copy); }
  return json;
}

/** Validation stored with a draft: deterministic warnings plus the model's own lists. */
export function buildValidation(input: {
  type: ContentType; purpose: string; language: ContentLanguage; content: LocalizedContent; factIndex: FactIndex; adLimits: Record<AdPlatform, AdPlatformLimits>;
  generatedAt: string | null; factsReadAt: string | null; model: string | null; sources: SourceRef[];
  missingInformation: string[]; claimsToReview: Array<{claim: string; reason: string}>; editedAfterGeneration: boolean;
}): DraftValidation {
  const missingInformation = [...new Set(input.missingInformation.map(item => item.trim()).filter(Boolean))].slice(0, 30);
  const claimsToReview = input.claimsToReview.filter(item => item.claim.trim()).slice(0, 30);
  return {
    schemaVersion: 1, generatedAt: input.generatedAt, factsReadAt: input.factsReadAt, model: input.model, sources: input.sources,
    warnings: validateContent(input), missingInformation, claimsToReview, editedAfterGeneration: input.editedAfterGeneration, factIndex: input.factIndex,
  };
}

/** True when every field of the content is empty: nothing useful was generated. */
export function isEmptyContent(type: ContentType, content: LocalizedContent) {
  return Object.values(content).every(value => !value || contentTexts(value).every(item => !item.text.trim()))
    || !CONTENT_CATALOG[type].fields.length;
}

/** Fact-checks one piece of free text outside a Content Studio draft (sales intelligence messages and briefs). */
export function factCheckText(text: string, field: string, index: FactIndex): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];
  checkText(text, {locale: "en", field}, index, new Set(index.numbers), new Set(index.contacts), warning => { if (warnings.length < 40) warnings.push(warning); }, false);
  return warnings;
}
