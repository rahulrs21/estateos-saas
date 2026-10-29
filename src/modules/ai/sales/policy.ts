import { z } from "zod";
import { LEAD_READINESS, LEAD_TIMELINES } from "./scoring";

/**
 * Request schemas for sales intelligence. Bodies are strict: organization,
 * user, role, membership, score or model fields are rejected (400), never
 * ignored. Identity, company and role always come from the verified session.
 */

const UUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
export const salesIdSchema = z.string().trim().regex(UUID, "Invalid record identifier.");

export const qualificationInputSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(1_000_000),
  timeline: z.enum(LEAD_TIMELINES).nullable(),
  readiness: z.enum(LEAD_READINESS).nullable(),
});

export const priorityReviewSchema = z.strictObject({
  assessmentId: salesIdSchema,
  reviewedPriority: z.enum(["HIGH", "MEDIUM", "LOW"]),
  reason: z.string().trim().min(10, "Give a reason of at least 10 characters.").max(500),
});

export const emptyBodySchema = z.strictObject({});
export const viewingBriefSchema = z.strictObject({leadId: salesIdSchema});

/** Dashboard scope: owners and administrators may choose company, one agent or one branch; others always see their own leads. */
export const scopeSchema = z.string().trim().regex(/^(?:company|mine|agent:[0-9a-f-]{32,36}|branch:[0-9a-f-]{32,36})$/i, "Invalid scope.").default("company");

export type DashboardScope = {kind: "company"} | {kind: "mine"} | {kind: "agent"; id: string} | {kind: "branch"; id: string};

export function resolveScope(raw: string, role: string): DashboardScope {
  const administrator = role === "OWNER" || role === "ADMIN";
  if (!administrator) return {kind: "mine"};
  const [kind, id] = raw.split(":");
  if (kind === "agent" && id) return {kind: "agent", id: id.replaceAll("-", "").toLowerCase()};
  if (kind === "branch" && id) return {kind: "branch", id: id.replaceAll("-", "").toLowerCase()};
  return {kind: "company"};
}
