import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";

/** Pure Copilot rules shared by the server and tests. */

/**
 * The chat request accepts only the message text and an optional conversation
 * id. Organization, user, role, membership and model are never accepted from
 * the browser; strictObject rejects them outright.
 */
export function chatRequestSchema(maxInputChars: number) {
  return z.strictObject({
    message: z.string().transform(value => value.replace(/\r\n?/g, "\n").trim())
      .pipe(z.string().min(1, "Type a question.").max(maxInputChars, `Keep questions under ${maxInputChars.toLocaleString("en-US")} characters.`)),
    conversationId: z.string().trim().transform(canonicalUuid).pipe(z.uuid()).optional(),
  });
}

export const conversationListSchema = z.strictObject({
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

/** UTC calendar month used for allowance counters, e.g. "2026-10". */
export function usagePeriodKey(now: Date) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function userQuotaKey(uid: string) {
  return `user:${uid}`.slice(0, 160);
}

/** Title from the first question: one line, at most 80 characters. No extra model call. */
export function conversationTitle(message: string) {
  const line = message.replace(/\s+/g, " ").trim();
  return line.length > 80 ? `${line.slice(0, 79).trimEnd()}…` : line || "New conversation";
}

/** Contains-match for SQL LIKE with wildcards in user text escaped. */
export function escapeLikeSearch(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? `%${trimmed.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}
