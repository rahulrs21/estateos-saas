import { normalizePhone } from "../leads/normalization";

/*
 * Customer numbers for calls (docs/TELEPHONY_PROVIDERS.md#destination-rules).
 * EstateOS never dials a typed number: the number comes from the lead or
 * contact on record, normalized to E.164 with the CRM's own normalizer, and
 * must use one of the company's allowed calling codes.
 */

export const E164 = /^\+[1-9]\d{6,14}$/;

/** E.164 for a stored number, or null when it cannot be normalized unambiguously. */
export function normalizeCallNumber(value: string | null | undefined): string | null {
  const normalized = normalizePhone(value).normalizedPhone;
  return normalized && E164.test(normalized) ? normalized : null;
}

export type DestinationProblem = "INVALID_NUMBER" | "COUNTRY_NOT_ALLOWED" | "PREMIUM_RATE_NUMBER";

/** UAE premium-rate numbers (+971 900…) are never dialled by EstateOS. */
const PREMIUM_PREFIXES = ["+971900"];

export function destinationProblems(number: string | null, allowedCallingCodes: readonly string[]): DestinationProblem[] {
  if (!number || !E164.test(number)) return ["INVALID_NUMBER"];
  const problems: DestinationProblem[] = [];
  if (!allowedCallingCodes.some(code => number.startsWith(`+${code}`))) problems.push("COUNTRY_NOT_ALLOWED");
  if (PREMIUM_PREFIXES.some(prefix => number.startsWith(prefix))) problems.push("PREMIUM_RATE_NUMBER");
  return problems;
}

type NumberRecord = {phone?: string | null; normalizedPhone?: string | null; alternatePhone?: string | null; normalizedAlternatePhone?: string | null};
/** Contacts store a normalized form, and the database compares calls against it; other records (a lead without a contact) are normalized here. */
const hasStoredForms = (record: NumberRecord) => "normalizedPhone" in record || "normalizedAlternatePhone" in record;

/** The customer's numbers on record (primary first), normalized and without duplicates. */
export function numbersOnRecord(record: NumberRecord) {
  const candidates = hasStoredForms(record)
    ? [record.normalizedPhone, record.normalizedAlternatePhone]
    : [normalizeCallNumber(record.phone), normalizeCallNumber(record.alternatePhone)];
  return [...new Set(candidates.filter((value): value is string => Boolean(value && E164.test(value))))];
}

/** Phones on a contact that were saved without their international form (for example older imports): re-saving the contact fixes them. */
export function numbersNeedingUpdate(record: NumberRecord) {
  if (!hasStoredForms(record)) return 0;
  return [[record.phone, record.normalizedPhone], [record.alternatePhone, record.normalizedAlternatePhone]]
    .filter(([raw, stored]) => Boolean(raw?.trim()) && !(stored && E164.test(stored))).length;
}

/** "+971 50 123 4567"-style display without changing the stored value. */
export function displayNumber(number: string | null | undefined) {
  if (!number) return "";
  const mobile = /^\+971(5\d)(\d{3})(\d{4})$/.exec(number);
  if (mobile) return `+971 ${mobile[1]} ${mobile[2]} ${mobile[3]}`;
  const landline = /^\+971([2-9])(\d{3})(\d{4})$/.exec(number);
  return landline ? `+971 ${landline[1]} ${landline[2]} ${landline[3]}` : number;
}
