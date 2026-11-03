import { createHash } from "node:crypto";

/*
 * Deterministic identifiers (docs/AUTOMATION_ENGINE.md#idempotency). Every
 * row a step creates (task, notification, note, approval, follow-on event)
 * gets an ID derived from the execution and step position, so a step that
 * runs twice (a retry, a worker restart, a queue delivering a job again)
 * hits the primary key instead of creating a duplicate.
 */

/** A UUID (version 4 layout) derived from the parts; the same parts always give the same UUID. */
export function stableUuid(...parts: Array<string | number>): string {
  const hex = createHash("sha256").update(parts.map(String).join("\u001f")).digest("hex");
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** The idempotency key of an execution step. */
export const stepKey = (executionId: string, position: number) => `${executionId.replaceAll("-", "").toLowerCase()}:${position}`;

/** The SHA-256 hex digest of text (definition hashes, approval snapshots). */
export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

/** The UTC day a daily limit counts against. */
export const periodKey = (date: Date) => date.toISOString().slice(0, 10);
