/** Conservative format normalization, not a claim that a number is reachable. */
export function normalizePhone(value: string | null | undefined) {
  if (!value) return { phone: null, normalizedPhone: null, warning: null };
  const original = value.trim();
  let digits = original.replace(/[ ()-]/g, "");
  if (digits.startsWith("00")) digits = "+" + digits.slice(2);
  // Recognizable UAE national mobile/landline forms; ambiguous local numbers
  // remain unchanged rather than assuming a country for an international user.
  if (/^0(?:5\d{8}|[234679]\d{7})$/.test(digits)) digits = "+971" + digits.slice(1);
  if (/^\+[1-9]\d{6,14}$/.test(digits)) return { phone: digits, normalizedPhone: digits, warning: null };
  return { phone: original, normalizedPhone: null, warning: "A phone number could not be normalized unambiguously; confirm its country code." };
}

/** Preserve the mailbox local part, including plus tags and dots. */
export function normalizeEmail(value: string) {
  const email = value.trim();
  const separator = email.lastIndexOf("@");
  return separator < 0 ? email : email.slice(0, separator) + "@" + email.slice(separator + 1).toLowerCase();
}
