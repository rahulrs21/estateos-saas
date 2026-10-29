import { z } from "zod";
import { WorkspaceError } from "../../organizations/server/errors";
import { canonicalUuid } from "../../organizations/server/identifiers";
import {
  CONTENT_AUDIENCES, CONTENT_LANGUAGES, CONTENT_LENGTHS, CONTENT_TONES, CONTENT_TYPES, DRAFT_STATUSES, MAX_PROPOSAL_LISTINGS, sourceProblem,
} from "./catalog";

/**
 * Request schemas for the Content Studio API. Bodies are strict: an
 * organization, user, role, agent or creator field is rejected, never
 * ignored. Record IDs are only references: the server re-reads every one
 * through the permission-checked CRM services before use.
 */

const uuid = z.string().trim().transform(canonicalUuid).pipe(z.uuid());
const purpose = z.string().trim().regex(/^[A-Z_]{2,40}$/);
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value ? value : undefined);

export function generateRequestSchema(maxInstructionsChars: number) {
  return z.strictObject({
    contentType: z.enum(CONTENT_TYPES),
    purpose,
    language: z.enum(CONTENT_LANGUAGES),
    tone: z.enum(CONTENT_TONES),
    audience: z.enum(CONTENT_AUDIENCES),
    length: z.enum(CONTENT_LENGTHS).default("STANDARD"),
    customInstructions: optionalText(maxInstructionsChars),
    templateId: uuid.optional(),
    propertyId: uuid.optional(),
    listingId: uuid.optional(),
    projectId: uuid.optional(),
    leadId: uuid.optional(),
    listingIds: z.array(uuid).max(MAX_PROPOSAL_LISTINGS).optional(),
    useLeadFirstName: z.boolean().default(true),
  }).superRefine((value, context) => {
    if (value.listingIds && new Set(value.listingIds).size !== value.listingIds.length) {
      context.addIssue({code: "custom", message: "Choose each listing only once.", path: ["listingIds"]});
      return;
    }
    const problem = sourceProblem(value.contentType, value.purpose, value);
    if (problem) context.addIssue({code: "custom", message: problem, path: ["purpose"]});
  });
}

export type GenerateRequest = z.infer<ReturnType<typeof generateRequestSchema>>;

export function draftGenerateSchema(maxInstructionsChars: number) {
  return z.strictObject({
    mode: z.enum(["REGENERATE", "ALTERNATIVE"]),
    expectedRevision: z.number().int().min(1).max(1_000_000),
    customInstructions: optionalText(maxInstructionsChars),
    length: z.enum(CONTENT_LENGTHS).optional(),
  });
}

export const saveDraftSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(1_000_000),
  title: z.string().trim().min(1).max(200),
  content: z.unknown(),
});

export const draftStatusSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(1_000_000),
  status: z.enum(DRAFT_STATUSES),
});

export const restoreVersionSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(1_000_000),
  versionNumber: z.number().int().min(1).max(100_000),
});

export const draftListSchema = z.strictObject({
  search: z.string().trim().max(120).optional().transform(value => value || undefined),
  view: z.enum(["ACTIVE", "ARCHIVED", ...DRAFT_STATUSES]).default("ACTIVE"),
  contentType: z.enum(CONTENT_TYPES).optional(),
  scope: z.enum(["MINE", "COMPANY"]).default("MINE"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const draftIdSchema = uuid;

/** Statuses for a list view; ACTIVE means everything except archived drafts. */
export function statusesForView(view: z.infer<typeof draftListSchema>["view"]) {
  if (view === "ACTIVE") return ["DRAFT", "IN_REVIEW", "APPROVED"] as const;
  return [view] as const;
}

/**
 * Editorial transitions. Approval is for owners and administrators only and
 * means "approved inside the agency", nothing more. Archived drafts can only
 * go back to DRAFT.
 */
export function allowedStatusChange(from: string, to: string, isAdministrator: boolean): boolean {
  if (from === to) return false;
  if (from === "ARCHIVED") return to === "DRAFT";
  if (to === "APPROVED") return isAdministrator && from === "IN_REVIEW" || isAdministrator && from === "DRAFT";
  return to === "DRAFT" || to === "IN_REVIEW" || to === "ARCHIVED";
}

/** Saving an edit to an approved draft sends it back to DRAFT for another approval. */
export function statusAfterEdit(current: string): "DRAFT" | "IN_REVIEW" {
  return current === "IN_REVIEW" ? "IN_REVIEW" : "DRAFT";
}

const phone = z.string().trim().max(32).regex(/^\+?[0-9][0-9 ()-]{6,30}$/, "Use a valid phone number.");
const httpsUrl = z.string().trim().max(2048).url().refine(value => /^https:\/\//i.test(value), "Use an https:// address.");

export const brandProfileSchema = z.strictObject({
  expectedRevision: z.number().int().min(0).max(1_000_000),
  displayName: optionalText(160),
  logoReference: z.union([httpsUrl, z.literal("")]).optional().transform(value => value || undefined),
  brandTone: optionalText(400),
  preferredLanguage: z.enum(CONTENT_LANGUAGES),
  useCompanyPhone: z.boolean(),
  useCompanyEmail: z.boolean(),
  website: z.union([httpsUrl, z.literal("")]).optional().transform(value => value || undefined),
  whatsappNumber: z.union([phone, z.literal("")]).optional().transform(value => value || undefined),
  defaultCallToAction: optionalText(200),
  tagline: optionalText(160),
  marketingDisclaimer: optionalText(1000),
});

export const templateInputSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  contentType: z.enum(CONTENT_TYPES),
  purpose: purpose.optional().or(z.literal("").transform(() => undefined)),
  instructions: z.string().trim().min(1).max(2000),
  tone: z.enum(CONTENT_TONES).optional(),
  language: z.enum(CONTENT_LANGUAGES).optional(),
  isActive: z.boolean().default(true),
});

export const templateUpdateSchema = templateInputSchema.extend({expectedRevision: z.number().int().min(1).max(1_000_000)});


/** Stored in the draft's sourceRefs column: what was selected, so regeneration re-reads the same records. */
export const generationSettingsSchema = z.object({
  schemaVersion: z.literal(1),
  selection: z.object({
    propertyId: z.string().optional(), listingId: z.string().optional(), projectId: z.string().optional(), leadId: z.string().optional(),
    listingIds: z.array(z.string()).max(MAX_PROPOSAL_LISTINGS).optional(),
  }),
  useLeadFirstName: z.boolean(),
  length: z.enum(CONTENT_LENGTHS),
});
export type GenerationSettings = z.infer<typeof generationSettingsSchema>;

export function parseGenerationSettings(raw: string): GenerationSettings | null {
  try {
    const result = generationSettingsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch { return null; }
}

/** Like validateInput, but keeps the specific message of a rule such as a missing source record. */
export function parseContentInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const custom = result.error.issues.find(issue => issue.code === "custom");
    throw new WorkspaceError("VALIDATION_ERROR", 400, custom?.message ?? "Check the supplied details and try again.");
  }
  return result.data;
}

/**
 * Unexpected (non-WorkspaceError) failures in Content Studio endpoints are
 * logged with their name and, outside production, a short message, so they are
 * diagnosable instead of surfacing only as a generic "temporarily unavailable".
 */
export function logUnexpectedContentError(endpoint: string, error: unknown) {
  if (error instanceof WorkspaceError) return;
  const detail = process.env.NODE_ENV !== "production" && error instanceof Error ? error.message.slice(0, 300) : undefined;
  console.error(JSON.stringify({event: "ai.content.unexpected_error", endpoint, name: error instanceof Error ? error.name : typeof error, ...(detail ? {detail} : {})}));
}
