import { normalizePhone } from "../leads/normalization";
import type { InboxChannel } from "./model";

/*
 * Customer identities and matching (docs/UNIFIED_INBOX.md#matching). A sender is
 * matched to a contact only by an exact normalized phone number or email
 * address on exactly one contact, never by name. Anything else stays unlinked
 * until a member links it, and that link is audited.
 */

const E164 = /^\+[1-9]\d{6,14}$/;
const EMAIL = /^[^\s@<>()",;:]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function normalizePhoneIdentity(raw: string | null | undefined): string | null {
  const normalized = normalizePhone(raw ?? "").normalizedPhone;
  return normalized && E164.test(normalized) ? normalized : null;
}

/** "Name <a@b.example>" or a bare address, lower-cased; null when it is not a single plain address. */
export function normalizeEmailIdentity(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const angle = /<([^<>]+)>\s*$/.exec(raw.trim());
  const address = (angle ? angle[1] : raw).trim().toLowerCase();
  return address.length <= 254 && EMAIL.test(address) ? address : null;
}

export interface Identity { kind: "PHONE" | "EMAIL"; value: string }

/** The identity a channel uses: WhatsApp numbers, email addresses; website enquiries prefer the email. */
export function channelIdentity(channel: InboxChannel, input: {phone?: string | null; email?: string | null}): Identity | null {
  const phone = normalizePhoneIdentity(input.phone);
  const email = normalizeEmailIdentity(input.email);
  if (channel === "WHATSAPP") return phone ? {kind: "PHONE", value: phone} : null;
  if (channel === "EMAIL") return email ? {kind: "EMAIL", value: email} : null;
  if (email) return {kind: "EMAIL", value: email};
  return phone ? {kind: "PHONE", value: phone} : null;
}

export interface MatchCandidate { id: string; leads: Array<{id: string; assignedMembershipId?: string | null}> }

export type MatchDecision =
  | {status: "MATCHED"; contactId: string; leadId: string | null; assignedMembershipId: string | null}
  | {status: "AMBIGUOUS"; candidates: number}
  | {status: "UNKNOWN"};

/**
 * Exactly one contact with this identity links the conversation to it; when that
 * contact has exactly one active lead the conversation joins the lead and goes to
 * the lead's agent (the lead itself is not changed). Several contacts are ambiguous.
 */
export function matchDecision(candidates: readonly MatchCandidate[]): MatchDecision {
  const contacts = [...new Map(candidates.map(candidate => [candidate.id.replaceAll("-", "").toLowerCase(), candidate])).values()];
  if (!contacts.length) return {status: "UNKNOWN"};
  if (contacts.length > 1) return {status: "AMBIGUOUS", candidates: contacts.length};
  const [contact] = contacts;
  const lead = contact.leads.length === 1 ? contact.leads[0] : null;
  return {status: "MATCHED", contactId: contact.id, leadId: lead?.id ?? null, assignedMembershipId: lead?.assignedMembershipId ?? null};
}

/** Whether a conversation's identity is one of the contact's own (shown when a member links it by hand). */
export function identityMatchesContact(identity: string, contact: {normalizedEmail?: string | null; normalizedPhone?: string | null; normalizedAlternatePhone?: string | null}) {
  return [contact.normalizedEmail, contact.normalizedPhone, contact.normalizedAlternatePhone].some(value => Boolean(value) && value === identity);
}
