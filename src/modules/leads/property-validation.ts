import { z } from "zod";
import { uuidSchema } from "../organizations/server/validation";

const notes = z.string().trim().max(4000).nullable().optional();
const timestamp = z.iso.datetime({offset: true});
const withinNextYear = (value: string) => {
  const time = Date.parse(value), now = Date.now();
  return time > now && time <= now + 365 * 24 * 60 * 60 * 1000;
};
export const viewingConfirmationValues = ["PENDING", "CONFIRMED", "DECLINED"] as const;
export const viewingOutcomeValues = ["POSITIVE", "NEUTRAL", "NEGATIVE", "NO_SHOW"] as const;

export const leadPropertyReadSchema = z.strictObject({
  leadId: uuidSchema,
  page: z.coerce.number().int().min(1).max(101).default(1),
});
export const leadPrimaryInterestSchema = z.strictObject({
  leadId: uuidSchema, projectId: uuidSchema.nullable(), propertyId: uuidSchema.nullable(),
});
export const leadPropertyInterestSchema = z.strictObject({
  leadId: uuidSchema, propertyId: uuidSchema,
  status: z.enum(["SAVED", "INTERESTED", "NOT_INTERESTED", "REMOVED"]),
  notes, expectedUpdatedAt: timestamp.optional(),
});
export const leadPropertyViewingSchema = z.strictObject({
  leadId: uuidSchema, propertyId: uuidSchema, notes,
  assignedMembershipId: uuidSchema,
  customerConfirmation: z.enum(viewingConfirmationValues).default("PENDING"),
  scheduledAt: timestamp.refine(withinNextYear, "Choose a future viewing within one year."),
});
export const updateLeadPropertyViewingSchema = z.strictObject({
  leadId: uuidSchema, viewingId: uuidSchema, notes,
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]), expectedUpdatedAt: timestamp,
  assignedMembershipId: uuidSchema,
  customerConfirmation: z.enum(viewingConfirmationValues),
  outcome: z.enum(viewingOutcomeValues).nullable().optional(),
  followUp: z.strictObject({
    title: z.string().trim().min(1, "Enter a follow-up task.").max(500),
    dueAt: timestamp.refine(withinNextYear, "Choose a follow-up date within the next year."),
  }).nullable().optional(),
}).superRefine((value, context) => {
  if (value.outcome && value.status !== "COMPLETED") {
    context.addIssue({code: "custom", path: ["outcome"], message: "Record an outcome only when the viewing is completed."});
  }
  if (value.followUp && value.status === "SCHEDULED") {
    context.addIssue({code: "custom", path: ["followUp"], message: "Create a follow-up when completing or cancelling the viewing."});
  }
});
