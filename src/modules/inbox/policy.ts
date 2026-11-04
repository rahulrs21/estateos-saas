import type { ConversationStatus, Role } from "./model";

export type { Role } from "./model";

/*
 * Inbox rules (docs/INBOX_SECURITY.md). The database repeats the access rules
 * in every operation; these functions let the server and UI explain them.
 */



/** OWNER, ADMIN and MANAGER assign anyone (or unassign); an AGENT may only take a conversation for themselves. */
export function canAssign(role: Role, input: {toSelf: boolean; unassign: boolean}) {
  if (role === "OWNER" || role === "ADMIN" || role === "MANAGER") return true;
  return input.toSelf && !input.unassign;
}

/** Status changes a member may make; any conversation can be reopened. */
export const STATUS_ACTIONS: Record<ConversationStatus, readonly ConversationStatus[]> = {
  OPEN: ["PENDING", "RESOLVED", "CLOSED"],
  PENDING: ["OPEN", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
  CLOSED: ["OPEN"],
};

/**
 * Whole-message opt-out keywords (the WhatsApp convention). Only a message that
 * consists of the keyword counts, so "please don't stop sending listings" does not.
 */
const OPT_OUT = /^\s*(stop|stop all|unsubscribe|opt[ -]?out|cancel|end|quit|إيقاف|الغاء|إلغاء|توقف)\s*[.!]?\s*$/i;
export const isOptOutMessage = (text: string | null | undefined) => Boolean(text && OPT_OUT.test(text));

/** WhatsApp: a free-form reply is allowed only within 24 hours of the customer's last message; otherwise an approved template is needed. */
export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 3_600_000;
export function serviceWindow(lastInboundAt: string | null | undefined, now: number) {
  if (!lastInboundAt) return {open: false, closesAt: null};
  const closes = Date.parse(lastInboundAt) + WHATSAPP_SERVICE_WINDOW_MS;
  return {open: now < closes, closesAt: new Date(closes).toISOString()};
}

/** A one-line preview: whitespace collapsed, bounded. */
export function preview(text: string | null | undefined, max = 200) {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Cursor for lists ordered by time (newest first): the last timestamp, and the IDs
 * already shown with exactly that timestamp (UUIDs cannot be ordered in filters).
 */
export function nextCursor<T extends {id: string}>(rows: readonly T[], at: (row: T) => string, pageSize: number) {
  if (rows.length <= pageSize) return null;
  const page = rows.slice(0, pageSize);
  const last = at(page[page.length - 1]);
  return {at: last, seen: page.filter(row => at(row) === last).map(row => row.id)};
}
