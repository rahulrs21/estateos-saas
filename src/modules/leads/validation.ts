import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";
import { leadStatuses } from "./types";

const uuid = z.string().transform(canonicalUuid).pipe(z.uuid());
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable().optional();
const fields = {
  fullName: z.string().trim().min(2, "Enter at least two characters.").max(160),
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254).nullable().optional(),
  phone: z.string().trim().min(6).max(32).regex(/^\+?[0-9 ()-]+$/, "Enter a valid phone number.").nullable().optional(),
  source: optionalText(120),
  branchId: uuid.nullable().optional(),
  assignedMembershipId: uuid.nullable().optional(),
};
export const createLeadSchema = z.strictObject(fields);
export const updateLeadSchema = z.strictObject({ ...fields, leadId: uuid, status: z.enum(leadStatuses) });
export const leadIdInputSchema = z.strictObject({ leadId: uuid });
export const leadStatusInputSchema = z.strictObject({ leadId: uuid, status: z.enum(leadStatuses) });
export const leadAssignmentInputSchema = z.strictObject({ leadId: uuid, assignedMembershipId: uuid.nullable() });
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
  search: z.string().trim().max(120).default(""),
  status: z.enum(leadStatuses).optional(),
  branchId: uuid.optional(),
  assignedMembershipId: uuid.optional(),
  followUp: z.enum(["ALL", "OVERDUE", "UPCOMING"]).default("ALL"),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10000).default(0),
});
export const leadPageFiltersSchema = z.strictObject({
  search: z.string().trim().max(120).default(""),
  status: z.union([z.enum(leadStatuses), z.literal("")]).default(""),
  branchId: z.union([uuid, z.literal("")]).default(""),
  assignedMembershipId: z.union([uuid, z.literal("")]).default(""),
  followUp: z.enum(["ALL", "OVERDUE", "UPCOMING"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(401).default(1),
  pageSize: z.coerce.number().int().refine(n => [10, 25, 50].includes(n), "Choose 10, 25 or 50 leads per page.").default(25),
}).refine(value => (value.page - 1) * value.pageSize <= 10000, "This page is outside the supported range.");

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

/** SQL LIKE wildcards are literal search characters, never filter instructions. */
export function escapeLeadSearch(value: string): string | undefined {
  return value ? `%${value.replace(/[\\%_]/g, "\\$&")}%` : undefined;
}
