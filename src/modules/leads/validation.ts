import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";
import { leadStatuses } from "./types";
import { contactFields, crmLeadFields, crmLeadFilterFields, validBudget } from "./crm-validation";

const uuid = z.string().transform(canonicalUuid).pipe(z.uuid());
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable().optional();
export const leadSorts = ["CREATED_DESC", "CREATED_ASC", "UPDATED_DESC", "NAME_ASC", "NAME_DESC", "FOLLOW_UP_ASC"] as const;
const calendarDate = z.iso.date().refine(value => Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)), "Choose a valid date.");
const dateRangeIsValid = (value: {createdFrom?: string; createdTo?: string}) => !value.createdFrom || !value.createdTo || value.createdFrom <= value.createdTo;
const futureTimestamp = z.iso.datetime({offset: true}).refine(value => Date.parse(value) > Date.now() && Date.parse(value) <= Date.now() + 365 * 86400000, "Choose a future date within one year.").transform(value => new Date(value).toISOString());
const fields = {
  fullName: z.string().trim().min(2, "Enter at least two characters.").max(160),
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254).nullable().optional(),
  phone: z.string().trim().min(6).max(32).regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number.").nullable().optional(),
  source: optionalText(120),
  branchId: uuid.nullable().optional(),
  assignedMembershipId: uuid.nullable().optional(),
};
export const createLeadSchema = z.strictObject({ ...fields, ...crmLeadFields, fullName: fields.fullName.optional(), email: contactFields.email,
  alternatePhone: contactFields.alternatePhone, nationality: contactFields.nationality,
  initialNote: optionalText(4000), initialFollowUpAt: futureTimestamp.nullable().optional(), initialFollowUpNote: optionalText(500),
})
  .refine(value => !!value.contactId || !!value.fullName, "Choose a contact or enter a full name.")
  .refine(validBudget, "Maximum budget must be at least the minimum budget.");
export const updateLeadSchema = z.strictObject({ ...fields, ...crmLeadFields, contactId: z.never().optional(), pipelineId: z.never().optional(), email: contactFields.email,
  alternatePhone: contactFields.alternatePhone, nationality: contactFields.nationality, leadId: uuid, status: z.enum(leadStatuses) })
  .refine(validBudget, "Maximum budget must be at least the minimum budget.");
export const leadIdInputSchema = z.strictObject({ leadId: uuid });
export const leadStatusInputSchema = z.strictObject({ leadId: uuid, status: z.enum(leadStatuses) });
export const leadAssignmentInputSchema = z.strictObject({
  leadId: uuid,
  assignedMembershipId: uuid.nullable(),
  reason: z.string().trim().min(1).max(500).default("Manual assignment"),
  overrideClosed: z.boolean().default(false),
});
export const leadNoteInputSchema = z.strictObject({ leadId: uuid, note: z.string().trim().min(1).max(4000) });
export const leadFollowUpInputSchema = z.strictObject({
  leadId: uuid,
  followUpAt: z.iso.datetime({ offset: true }).refine((value) => {
    const due = Date.parse(value);
    return due > Date.now() && due <= Date.now() + 365 * 24 * 60 * 60 * 1000;
  }, "Choose a future date within the next year."),
  followUpNote: optionalText(500),
});
export const leadListInputSchema = z.strictObject({
  ...crmLeadFilterFields,
  search: z.string().trim().max(120).default(""),
  status: z.enum(leadStatuses).optional(),
  branchId: uuid.optional(),
  assignedMembershipId: uuid.optional(),
  followUp: z.enum(["ALL", "OVERDUE", "UPCOMING"]).default("ALL"),
  createdFrom: calendarDate.optional(), createdTo: calendarDate.optional(),
  sort: z.enum(leadSorts).default("CREATED_DESC"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10000).default(0),
}).refine(dateRangeIsValid, "The end date must be on or after the start date.");
export const leadPageFiltersSchema = z.strictObject({
  search: z.string().trim().max(120).default(""),
  status: z.union([z.enum(leadStatuses), z.literal("")]).default(""),
  branchId: z.union([uuid, z.literal("")]).default(""),
  assignedMembershipId: z.union([uuid, z.literal("")]).default(""),
  sourceId: z.union([uuid, z.literal("")]).default(""),
  priority: z.union([z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]), z.literal("")]).default(""),
  createdFrom: z.union([calendarDate, z.literal("")]).default(""),
  createdTo: z.union([calendarDate, z.literal("")]).default(""),
  sort: z.enum(leadSorts).default("CREATED_DESC"),
  view: z.enum(["LIST", "KANBAN"]).default("LIST"),
  followUp: z.enum(["ALL", "OVERDUE", "UPCOMING"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(401).default(1),
  pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n), "Choose 10, 25 or 50 leads per page.").default(25),
}).refine(value => (value.page - 1) * value.pageSize <= 10000, "This page is outside the supported range.")
  .refine(dateRangeIsValid, "The end date must be on or after the start date.");

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/** SQL LIKE wildcards are literal search characters, never filter instructions. */
export function escapeLeadSearch(value: string): string | undefined {
  return value ? `%${value.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}
