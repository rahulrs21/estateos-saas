/*
 * Phase 7G.1: what a WhatsApp customer shares besides text and files (docs/WHATSAPP_MEDIA_PLAN.md): a location,
 * contacts, or a reaction. Pure. Everything comes from the sender and is untrusted: coordinates must be in range,
 * text is bounded with control characters removed, numbers keep only digits and a leading +. The details are stored as
 * bounded JSON and validated again before they are shown (as text, never HTML).
 */

export type MessageDetails =
  | { kind: "location"; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: "contacts"; contacts: Array<{ name: string; phones: Array<{ phone: string; waId: string | null }>; emails: string[] }> };

const MAX_JSON = 4000;
const clean = (value: unknown, max: number) => {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};
const coordinate = (value: unknown, limit: number) => {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) && Math.abs(number) <= limit ? Math.round(number * 1e6) / 1e6 : null;
};
const phone = (value: unknown) => {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return /^\+?\d{4,20}$/.test(digits) ? digits : null;
};
const email = (value: unknown) => typeof value === "string" && /^[^\s@<>]{1,64}@[^\s@<>]{1,190}$/.test(value.trim()) ? value.trim().toLowerCase() : null;

/** A shared location: the details and the text the inbox shows and searches. */
export function parseLocation(raw: unknown): { details: MessageDetails; text: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const latitude = coordinate(value.latitude, 90), longitude = coordinate(value.longitude, 180);
  if (latitude === null || longitude === null) return null;
  const name = clean(value.name, 200), address = clean(value.address, 300);
  return { details: { kind: "location", latitude, longitude, name, address }, text: `Location: ${[name, address].filter(Boolean).join(", ") || `${latitude}, ${longitude}`}` };
}

/** Shared contacts (at most 5, each with at most 5 numbers and 3 emails). */
export function parseContacts(raw: unknown): { details: MessageDetails; text: string } | null {
  if (!Array.isArray(raw)) return null;
  const contacts = raw.slice(0, 5).flatMap(item => {
    const value = (item ?? {}) as Record<string, unknown>;
    const nameValue = (value.name ?? {}) as Record<string, unknown>;
    const name = clean(nameValue.formatted_name, 160) ?? clean([nameValue.first_name, nameValue.last_name].filter(part => typeof part === "string").join(" "), 160);
    const phones = (Array.isArray(value.phones) ? value.phones : []).slice(0, 5).flatMap(entry => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const number = phone(row.phone) ?? (typeof row.wa_id === "string" ? phone(`+${row.wa_id}`) : null);
      return number ? [{ phone: number, waId: typeof row.wa_id === "string" && /^\d{4,20}$/.test(row.wa_id) ? row.wa_id : null }] : [];
    });
    const emails = (Array.isArray(value.emails) ? value.emails : []).slice(0, 3).flatMap(entry => { const address = email((entry as Record<string, unknown> | null)?.email); return address ? [address] : []; });
    if (!name && phones.length === 0) return [];
    return [{ name: name ?? phones[0].phone, phones, emails }];
  });
  if (contacts.length === 0) return null;
  const first = contacts[0];
  const text = `Contact: ${first.name}${first.phones[0] ? ` (${first.phones[0].phone})` : ""}${contacts.length > 1 ? ` and ${contacts.length - 1} more` : ""}`;
  return { details: { kind: "contacts", contacts }, text };
}

/** A reaction to an earlier message, as text ("Reacted 👍 to a message"; an empty emoji removes it). */
export function reactionText(raw: unknown) {
  const emoji = raw && typeof raw === "object" ? clean((raw as Record<string, unknown>).emoji, 16) : null;
  return emoji ? `Reacted ${emoji} to a message` : "Removed a reaction";
}

/** Bounded JSON for storage (null if it would not fit). */
export function serializeDetails(details: MessageDetails | null | undefined) {
  if (!details) return null;
  const json = JSON.stringify(details);
  return json.length <= MAX_JSON ? json : null;
}

/** Stored JSON back to details, validated again (anything else is ignored). */
export function readDetails(json: string | null | undefined): MessageDetails | null {
  if (!json || json.length > MAX_JSON) return null;
  let value: unknown;
  try { value = JSON.parse(json); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (record.kind === "location") return parseLocation(record)?.details ?? null;
  if (record.kind === "contacts" && Array.isArray(record.contacts)) {
    // Stored contacts use the stored shape; map it back through the same checks.
    return parseContacts((record.contacts as Array<Record<string, unknown>>).map(contact => ({
      name: { formatted_name: contact.name },
      phones: Array.isArray(contact.phones) ? (contact.phones as Array<Record<string, unknown>>).map(entry => ({ phone: entry.phone, wa_id: entry.waId ?? undefined })) : [],
      emails: Array.isArray(contact.emails) ? (contact.emails as unknown[]).map(address => ({ email: address })) : [],
    })))?.details ?? null;
  }
  return null;
}

/** A Google Maps link for a location (coordinates only, nothing from the sender's text). */
export const mapsUrl = (latitude: number, longitude: number) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
