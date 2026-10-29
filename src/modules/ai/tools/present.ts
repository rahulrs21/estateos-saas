import { emirateLabels, parseMapDisplayMode, type Emirate } from "../../maps/geo";

/**
 * Pure presenters that turn authorized service records into the minimal data
 * Claude needs. They are allowlists: anything not copied here (contact
 * details, internal notes, mandate/ownership references, coordinates, place
 * IDs, media file names, member emails) never reaches the model.
 */

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f‪-‮⁦-⁩]/g;

/** Untrusted record text: strip control and bidi-override characters, collapse whitespace, cap length. */
export function cleanText(value: string | null | undefined, max = 160): string | null {
  if (value == null) return null;
  const cleaned = value.replace(CONTROL, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max ? `${cleaned.slice(0, max - 1).trimEnd()}…` : cleaned;
}

export function humanize(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replaceAll("_", " ").toLowerCase().replace(/^\w/, letter => letter.toUpperCase());
}

export function emirateName(value: string | null | undefined) {
  return value && Object.hasOwn(emirateLabels, value) ? emirateLabels[value as Emirate] : cleanText(value, 40);
}

/** Minor-unit integer string (fils) to a major-unit amount; null for invalid input. */
export function minorToMajor(minor: string | number | bigint | null | undefined): number | null {
  if (minor == null || minor === "") return null;
  const text = String(minor);
  if (!/^-?\d{1,18}$/.test(text)) return null;
  return Number(BigInt(text)) / 100;
}

export function formatMoney(amount: number | null, currency: string | null | undefined) {
  if (amount == null) return null;
  const code = /^[A-Z]{3}$/.test(currency ?? "") ? currency! : "AED";
  return `${code} ${amount.toLocaleString("en-US", {maximumFractionDigits: 2})}`;
}

export function money(minor: string | number | null | undefined, currency: string | null | undefined, kind: string) {
  const amount = minorToMajor(minor);
  return amount == null ? null : {amount, currency: /^[A-Z]{3}$/.test(currency ?? "") ? currency : "AED", display: formatMoney(amount, currency), kind};
}

/** Major-unit AED filter amount to a minor-unit string for stored queries. */
export function majorToMinor(amount: number | undefined): string | undefined {
  if (amount === undefined) return undefined;
  return BigInt(Math.round(amount * 100)).toString();
}

export interface LocationFields {
  emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
  address?: string | null; mapDisplayMode?: string | null;
}

/**
 * Text location for the model. Coordinates and place IDs are never included.
 * The street address is included only when the record's map mode is EXACT;
 * APPROXIMATE and HIDDEN records (and unknown modes) keep only area-level text.
 */
export function presentLocation(record: LocationFields) {
  const mode = parseMapDisplayMode(record.mapDisplayMode, "HIDDEN");
  return {
    emirate: emirateName(record.emirate),
    city: cleanText(record.city, 80),
    community: cleanText(record.community, 120),
    area: cleanText(record.area, 120),
    ...(mode === "EXACT" && record.address ? {address: cleanText(record.address, 200)} : {}),
    mapVisibility: mode,
  };
}

const normalize = (value: string) => value.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/** Common UAE abbreviations and short names, expanded before matching. */
const LOCATION_ALIASES: Record<string, string[]> = {
  "jvc": ["jumeirah village circle"],
  "jvt": ["jumeirah village triangle"],
  "jlt": ["jumeirah lake towers", "jumeirah lakes towers"],
  "jbr": ["jumeirah beach residence"],
  "difc": ["dubai international financial centre", "difc"],
  "downtown": ["downtown dubai", "downtown"],
  "marina": ["dubai marina", "marina"],
  "dubai hills": ["dubai hills estate", "dubai hills"],
  "palm": ["palm jumeirah"],
  "the palm": ["palm jumeirah"],
  "mbr city": ["mohammed bin rashid city", "mbr city"],
  "meydan": ["meydan", "mohammed bin rashid city"],
  "dso": ["dubai silicon oasis"],
  "jgr": ["jumeirah golf estates"],
  "saadiyat": ["saadiyat island"],
  "yas": ["yas island"],
  "reem": ["al reem island", "reem island"],
};

export function locationCandidates(query: string): string[] {
  const key = normalize(query);
  const aliases = LOCATION_ALIASES[key] ?? [];
  return [...new Set([key, ...aliases.map(normalize)])].filter(Boolean);
}

/** True when every word of any candidate appears in the record's combined location text. */
export function locationMatches(query: string, fields: Array<string | null | undefined>) {
  const haystack = new Set(normalize(fields.filter(Boolean).join(" ")).split(" "));
  return locationCandidates(query).some(candidate => candidate.split(" ").every(word => haystack.has(word)));
}

export function textMatches(query: string, fields: Array<string | null | undefined>) {
  const needle = normalize(query);
  return Boolean(needle) && fields.some(field => field && normalize(field).includes(needle));
}

/** A lead budget range overlaps the requested range (open-ended where unset). */
export function budgetOverlaps(lead: {budgetMin?: number | null; budgetMax?: number | null}, min?: number, max?: number) {
  const low = lead.budgetMin ?? lead.budgetMax ?? null;
  const high = lead.budgetMax ?? lead.budgetMin ?? null;
  if (low == null && high == null) return min === undefined && max === undefined;
  if (min !== undefined && high != null && high < min) return false;
  if (max !== undefined && low != null && low > max) return false;
  return true;
}

/** Start and end (exclusive) of the current day in Dubai (UTC+4, no daylight saving), as ISO strings. */
export function dubaiDayRange(nowMs: number) {
  const offset = 4 * 60 * 60 * 1000;
  const local = new Date(nowMs + offset);
  const start = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - offset;
  return {start: new Date(start).toISOString(), end: new Date(start + 86_400_000).toISOString()};
}

export function areaText(value: number | null | undefined, unit: string | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toLocaleString("en-US", {maximumFractionDigits: 2})} ${unit === "SQM" ? "sq m" : "sq ft"}`;
}

export const recordLinks = {
  property: (id: string) => `/properties/${id}`,
  listing: (id: string) => `/listings/${id}`,
  project: (id: string) => `/projects/${id}`,
  developer: (id: string) => `/developers/${id}`,
  lead: (id: string) => `/leads/${id}`,
};

/** Display name for a team member; never the email address. */
export function memberName(member: {userProfile?: {displayName?: string | null} | null} | null | undefined) {
  return cleanText(member?.userProfile?.displayName, 80) ?? (member ? "Team member" : null);
}
