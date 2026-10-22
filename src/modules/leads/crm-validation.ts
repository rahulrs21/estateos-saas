import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";
import { normalizeEmail, normalizePhone } from "./normalization";

export const crmUuid = z.string().transform(canonicalUuid).pipe(z.uuid());
const text = (max: number) => z.string().trim().min(1).max(max).nullable().optional();
const phone = z.string().trim().min(6).max(32).regex(/^\+?[0-9 ()-]+$/).nullable().optional();
export const contactFields = {
  fullName: z.string().trim().min(2).max(160),
  email: z.string().transform(normalizeEmail).pipe(z.email().max(254)).nullable().optional(),
  phone, alternatePhone: phone,
  nationality: text(80),
  preferredLanguage: z.string().trim().min(2).max(35).regex(/^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/).default("en"),
  notes: text(4000),
};
export const createContactSchema = z.strictObject(contactFields);
export const updateContactSchema = z.strictObject({ ...contactFields, contactId: crmUuid });
export const contactIdSchema = z.strictObject({ contactId: crmUuid });
export const searchContactsSchema = z.strictObject({
  search: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const duplicateContactSchema = z.strictObject({
  email: contactFields.email, phone, alternatePhone: phone,
}).refine(value => !!(value.email || value.phone || value.alternatePhone), "Provide an email or phone number.");
export const crmLeadFields = {
  contactId: crmUuid.optional(), sourceId: crmUuid.nullable().optional(), pipelineId: crmUuid.optional(),
  // Future modules must validate these references before accepting non-null IDs.
  // Projects are a future module; this UUID is intentionally not a foreign key yet.
  projectId: crmUuid.nullable().optional(), propertyId: z.null().optional(),
  propertyInterest: text(500), preferredLocation: text(160), propertyType: text(80),
  transactionType: z.enum(["BUY", "RENT", "INVEST"]).optional(),
  budgetMin: z.number().finite().min(0).max(1_000_000_000_000).multipleOf(0.01).nullable().optional(),
  budgetMax: z.number().finite().min(0).max(1_000_000_000_000).multipleOf(0.01).nullable().optional(),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  bedroomPreference: text(40), priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
};
export const crmLeadFilterFields = {
  contactId: crmUuid.optional(), pipelineId: crmUuid.optional(), pipelineStageId: crmUuid.optional(),
  sourceId: crmUuid.optional(), priority: crmLeadFields.priority, transactionType: crmLeadFields.transactionType,
  archive: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
};
export function validBudget(value: {budgetMin?: number | null; budgetMax?: number | null}) {
  return value.budgetMin == null || value.budgetMax == null || value.budgetMax >= value.budgetMin;
}
export const moveLeadStageSchema = z.strictObject({leadId: crmUuid, pipelineStageId: crmUuid});
export const createFollowUpSchema = z.strictObject({
  leadId: crmUuid, title: z.string().trim().min(1).max(500), assignedUserId: crmUuid.optional(),
  dueAt: z.iso.datetime({offset: true}).refine(value => Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + 365 * 86400000, "Choose a future date within one year.").transform(value => new Date(value).toISOString()),
});
export const completeFollowUpSchema = z.strictObject({leadId: crmUuid, followUpId: crmUuid.optional()});
export const leadHistorySchema = z.strictObject({leadId: crmUuid, limit: searchContactsSchema.shape.limit, offset: searchContactsSchema.shape.offset});

export function normalizedContact(input: z.infer<typeof createContactSchema>) {
  const primary = normalizePhone(input.phone);
  const alternate = normalizePhone(input.alternatePhone);
  return {
    variables: { ...input, email: input.email ?? null, phone: primary.phone, normalizedPhone: primary.normalizedPhone,
      alternatePhone: alternate.phone, normalizedAlternatePhone: alternate.normalizedPhone, nationality: input.nationality ?? null, notes: input.notes ?? null },
    warnings: [primary.warning, alternate.warning].filter((warning): warning is string => !!warning),
  };
}
