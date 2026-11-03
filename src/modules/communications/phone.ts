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

/** The customer's numbers on record (primary first), normalized and without duplicates. */
export function numbersOnRecord(record: {phone?: string | null; normalizedPhone?: string | null; alternatePhone?: string | null; normalizedAlternatePhone?: string | null}) {
  const candidates = [record.normalizedPhone ?? normalizeCallNumber(record.phone), record.normalizedAlternatePhone ?? normalizeCallNumber(record.alternatePhone)];
  return [...new Set(candidates.filter((value): value is string => Boolean(value && E164.test(value))))];
}

/** "+971 50 123 4567"-style display without changing the stored value. */
export function displayNumber(number: string | null | undefined) {
  if (!number) return "";
  const mobile = /^\+971(5\d)(\d{3})(\d{4})$/.exec(number);
  if (mobile) return `+971 ${mobile[1]} ${mobile[2]} ${mobile[3]}`;
  const landline = /^\+971([2-9])(\d{3})(\d{4})$/.exec(number);
  return landline ? `+971 ${landline[1]} ${landline[2]} ${landline[3]}` : number;
}
