import { z } from "zod";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";

const uuid = z.string().transform(canonicalUuid).pipe(z.uuid());
const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, such as 09:00.");

function validTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const distributionSettingsSchema = z.strictObject({
  enabled: z.boolean(),
  mode: z.enum(["MANUAL", "ROUND_ROBIN"]),
  branchId: uuid.nullable(),
  projectId: uuid.nullable(),
  skipUnavailable: z.boolean(),
  businessHoursEnabled: z.boolean(),
  timeZone: z.string().trim().min(1).max(64).refine(validTimeZone, "Choose a valid time zone."),
  businessDaysMask: z.number().int().min(1).max(127),
  businessStart: clock,
  businessEnd: clock,
  reassignmentTimeoutMinutes: z.number().int().min(5).max(43_200),
  eligibleAgentIds: z.array(uuid).max(100).superRefine((ids, context) => {
    if (new Set(ids).size !== ids.length) context.addIssue({ code: "custom", message: "An agent can only be selected once." });
  }),
}).refine(value => value.businessStart < value.businessEnd, {
  path: ["businessEnd"], message: "Business hours must end after they start.",
});

export const distributionPreviewSchema = z.strictObject({
  branchId: uuid.nullable().default(null),
  projectId: uuid.nullable().default(null),
});

export const availabilityInputSchema = z.strictObject({
  membershipId: uuid.optional(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  unavailableUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  reason: z.string().trim().max(240).nullable().optional(),
}).refine(value => value.status !== "UNAVAILABLE" || !value.unavailableUntil || Date.parse(value.unavailableUntil) > Date.now(), {
  path: ["unavailableUntil"], message: "Choose a future time, or leave it blank for no expiry.",
});

export const notificationListSchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const notificationIdSchema = z.strictObject({ notificationId: uuid });

export type DistributionSettingsInput = z.infer<typeof distributionSettingsSchema>;
