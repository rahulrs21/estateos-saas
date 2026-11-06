import type { ConversationStatus, DeliveryStatus, Role } from "./model";

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

/*
 * Delivery receipts move an outbound message forward only (docs/CHANNEL_ADAPTERS.md#delivery-receipts):
 * QUEUED → SENT → DELIVERED → READ, or FAILED before it is delivered. Late or
 * repeated receipts change nothing; an unrecognised status is kept as raw text only.
 */
const DELIVERY_ORDER: Partial<Record<DeliveryStatus, number>> = {QUEUED: 1, SENT: 2, DELIVERED: 3, READ: 4};
export type DeliveryDecision = {apply: true; status: DeliveryStatus} | {apply: false; reason: "DUPLICATE" | "OUT_OF_ORDER" | "FINAL" | "NOT_OUTBOUND" | "RAW_ONLY"};
export function deliveryTransition(current: DeliveryStatus, next: DeliveryStatus): DeliveryDecision {
  if (current === next) return {apply: false, reason: "DUPLICATE"};
  if (!(current in DELIVERY_ORDER) && current !== "FAILED") return {apply: false, reason: "NOT_OUTBOUND"};
  if (current === "FAILED") return {apply: false, reason: "FINAL"};
  if (next === "UNKNOWN") return {apply: false, reason: "RAW_ONLY"};
  if (next === "FAILED") return current === "QUEUED" || current === "SENT" ? {apply: true, status: next} : {apply: false, reason: "OUT_OF_ORDER"};
  const from = DELIVERY_ORDER[current]!, to = DELIVERY_ORDER[next];
  if (to === undefined) return {apply: false, reason: "OUT_OF_ORDER"};
  return to > from ? {apply: true, status: next} : {apply: false, reason: "OUT_OF_ORDER"};
}

/** Failed inbox events are retried by the worker with growing delays, then left DEAD for review. */
export const MAX_EVENT_ATTEMPTS = 5;
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
export function eventRetry(attemptsSoFar: number, now: number): {dead: true} | {dead: false; nextAttemptAt: string} {
  if (attemptsSoFar + 1 >= MAX_EVENT_ATTEMPTS) return {dead: true};
  return {dead: false, nextAttemptAt: new Date(now + RETRY_DELAYS_MS[Math.min(attemptsSoFar, RETRY_DELAYS_MS.length - 1)]).toISOString()};
}

/** Retention (docs/INBOX_SECURITY.md#retention): message content older than the company's period is removed. */
export const DEFAULT_RETENTION_DAYS = 730;
export const retentionCutoff = (retentionDays: number | null | undefined, now: number) => new Date(now - (retentionDays ?? DEFAULT_RETENTION_DAYS) * 86_400_000).toISOString();

/** Only files under the company's own inbox folder are ever deleted (canonical, hyphenated company ID). */
export function ownedAttachmentPath(organizationId: string, path: string | null | undefined) {
  if (!path) return null;
  const compact = organizationId.replaceAll("-", "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;
  const canonical = `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
  const prefix = `organizations/${canonical}/inbox/`;
  return path.startsWith(prefix) && !path.includes("..") && !path.includes("\\") ? path : null;
}
