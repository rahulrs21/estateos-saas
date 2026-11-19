import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";
import { ATTESTATIONS } from "./checklist";
import { DESIGN_STYLES, plainText, slugSchema } from "./registry";
import { SECTION_TEMPLATE_CATEGORIES } from "./library";
import { PAGE_STRUCTURES } from "./structures";
import { TEMPLATE_KEYS } from "./templates";

/**
 * Request schemas for the website builder API. All are strict: an
 * organization ID, role, status, author, snapshot or any other unexpected
 * field is rejected. The company and role always come from the verified
 * session, and record IDs are only references that the server re-authorizes.
 */

/** Record IDs in dashed or SQL Connect's 32-character form, normalized to the dashed form. */
const recordId = z.string().max(40).transform(canonicalUuid).pipe(z.uuid());
export const pageIdSchema = recordId;
const optionalId = recordId.nullable().optional();
const revision = z.number().int().min(1).max(1_000_000);
export const MAX_BRIEF_CHARS = 2000;

export const createPageSchema = z.strictObject({
  mode: z.enum(["BLANK", "TEMPLATE", "DUPLICATE"]),
  templateKey: z.enum(TEMPLATE_KEYS).optional(),
  sourcePageId: recordId.optional(),
  title: plainText(160, 1),
  slug: slugSchema.optional(),
  style: z.enum(DESIGN_STYLES).optional(),
  projectId: optionalId, propertyId: optionalId, listingId: optionalId,
}).superRefine((value, context) => {
  if (value.mode === "TEMPLATE" && !value.templateKey) context.addIssue({code: "custom", path: ["templateKey"], message: "Choose a template."});
  if (value.mode === "DUPLICATE" && !value.sourcePageId) context.addIssue({code: "custom", path: ["sourcePageId"], message: "Choose a page to duplicate."});
  if (value.propertyId && value.listingId) context.addIssue({code: "custom", path: ["propertyId"], message: "Choose a listing or a property, not both."});
});

export const generatePageSchema = z.strictObject({
  title: plainText(160, 1),
  slug: slugSchema.optional(),
  brief: plainText(MAX_BRIEF_CHARS),
  style: z.enum(DESIGN_STYLES).nullable().optional(),
  /** Null uses the style's own structure; with no style either, Claude chooses both. */
  structure: z.enum(PAGE_STRUCTURES).nullable().optional(),
  templateKey: z.enum(TEMPLATE_KEYS).nullable().optional(),
  projectId: optionalId, propertyId: optionalId, listingId: optionalId,
}).refine(value => !(value.propertyId && value.listingId), {path: ["propertyId"], message: "Choose a listing or a property, not both."});

/** A readable message for the first problem in a generation request (wizard and editor). */
export function generationRequestProblem(issues: ReadonlyArray<{code: string; path: ReadonlyArray<PropertyKey>}>): string {
  const issue = issues[0];
  if (!issue) return "Check the supplied details and try again.";
  // A field the server does not know: the browser has a newer or older version of the form than the server.
  if (issue.code === "unrecognized_keys") return "This form is out of date. Reload the page and try again.";
  const field = String(issue.path[0] ?? "");
  if (issue.code === "custom" && field === "propertyId") return "Choose a listing or a property, not both.";
  const messages: Record<string, string> = {
    title: "Give the page a title (up to 160 characters, plain text).",
    slug: "Use lowercase letters, numbers and single hyphens for the page address.",
    brief: "Describe the page in plain text, up to 2,000 characters. HTML, scripts and links cannot be used.",
    style: "Choose a design style from the list.",
    structure: "Choose a page structure from the list.",
    templateKey: "Choose a template from the list.",
    projectId: "The linked record could not be read. Choose it again.",
    propertyId: "The linked record could not be read. Choose it again.",
    listingId: "The linked record could not be read. Choose it again.",
    expectedRevision: "This page changed. Reload it and try again.",
  };
  return messages[field] ?? "Check the supplied details and try again.";
}

export const regeneratePageSchema = z.strictObject({
  expectedRevision: revision,
  brief: plainText(MAX_BRIEF_CHARS),
  style: z.enum(DESIGN_STYLES).nullable().optional(),
  structure: z.enum(PAGE_STRUCTURES).nullable().optional(),
});

export const savePageSchema = z.strictObject({
  expectedRevision: revision,
  title: plainText(160, 1),
  slug: slugSchema,
  description: plainText(500).nullable(),
  seoTitle: plainText(120).nullable(),
  seoDescription: plainText(320).nullable(),
  /** Validated against the component registry by the service. */
  data: z.unknown(),
});

export const revisionSchema = z.strictObject({expectedRevision: revision});
export const restoreSchema = z.strictObject({expectedRevision: revision, versionNumber: z.number().int().min(1)});
export const approveSchema = z.strictObject({expectedRevision: revision, versionNumber: z.number().int().min(1)});
export const rejectSchema = z.strictObject({expectedRevision: revision, note: plainText(500, 3)});
export const publishSchema = z.strictObject({
  expectedRevision: revision,
  /** Set only to republish an earlier approved version (rollback). */
  versionNumber: z.number().int().min(1).optional(),
  attestations: z.array(z.enum(Object.keys(ATTESTATIONS) as [keyof typeof ATTESTATIONS, ...Array<keyof typeof ATTESTATIONS>])).max(8),
});
export const formBindingSchema = z.strictObject({formId: recordId.nullable()});
export const websiteSettingsSchema = z.strictObject({
  expectedRevision: revision,
  name: plainText(120, 2),
  allowAgentDrafts: z.boolean(),
  defaultStyle: z.enum(DESIGN_STYLES).nullable(),
});
export const emptyBodySchema = z.strictObject({});

const contactPhone = z.union([z.string().trim().max(32).regex(/^\+?[0-9][0-9 ()-]{6,30}$/, "Use a valid phone number."), z.literal("")]).transform(value => value || null);
/** A member's public agent card on website contact sections. */
export const agentCardSchema = z.strictObject({
  websiteTitle: z.union([plainText(80), z.literal("")]).transform(value => value.trim() || null),
  websitePhone: contactPhone,
  websiteWhatsapp: contactPhone,
});
export const membershipIdSchema = recordId;
export const recordIdSchema = recordId;
export const mediaAltSchema = z.strictObject({alt: z.union([plainText(160), z.literal("")])});

/** Saving a section to the company library; the section is validated again on the server. */
export const sectionTemplateSchema = z.strictObject({
  name: plainText(120, 1),
  category: z.enum(SECTION_TEMPLATE_CATEGORIES).default("General"),
  section: z.unknown(),
});
