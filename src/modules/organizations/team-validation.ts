import { z } from "zod";
import { uuidSchema } from "./server/validation";

export const teamInviteSchema = z.strictObject({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email.").max(254)),
  role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
});
export const invitationActionSchema = z.strictObject({ membershipId: uuidSchema });
export const teamRoleSchema = z.strictObject({ membershipId: uuidSchema, role: z.enum(["ADMIN", "MANAGER", "AGENT"]) });
export const teamSuspensionSchema = z.strictObject({ membershipId: uuidSchema, status: z.literal("SUSPENDED") });
export const teamPageSchema = z.strictObject({
  search: z.string().trim().max(120).default(""),
  page: z.coerce.number().int().min(1).max(401).default(1),
  status: z.enum(["ALL", "ACTIVE", "SUSPENDED", "PENDING", "REMOVED", "REVOKED"]).default("ALL"),
});
export const invitationPageSchema = teamPageSchema.extend({
  status: z.enum(["ALL", "PENDING", "ACCEPTED", "REVOKED"]).default("ALL"),
});
export function teamSearchPattern(value: string): string | undefined {
  return value ? "%" + value.replace(/[\\%_]/g, "\\$&") + "%" : undefined;
}
