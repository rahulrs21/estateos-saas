import { z } from "zod";
import { WorkspaceError } from "./errors";
import { canonicalUuid } from "./identifiers";
import { companyDetailsSchema, organizationNameSchema, organizationSlugSchema } from "../validation";

export const uuidSchema = z.string().transform(canonicalUuid).pipe(z.uuid());
const nameSchema = z.string().trim().min(2).max(120);
const emailSchema = z.email().trim().toLowerCase().max(254);

export const profileInputSchema = z.strictObject({ displayName: nameSchema });
export const createOrganizationInputSchema = z.strictObject({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  emirate: companyDetailsSchema.shape.emirate.optional(),
  contactPhone: companyDetailsSchema.shape.contactPhone.optional(),
  companyEmail: companyDetailsSchema.shape.companyEmail.optional(),
  companySize: companyDetailsSchema.shape.companySize.optional(),
});
export const switchOrganizationInputSchema = z.strictObject({ organizationId: uuidSchema });
export const createBranchInputSchema = z.strictObject({ name: nameSchema });
export const inviteMembershipInputSchema = z.strictObject({
  email: emailSchema,
  role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
});
export const acceptInvitationInputSchema = z.strictObject({
  organizationId: uuidSchema,
  membershipId: uuidSchema,
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
export const membershipIdInputSchema = z.strictObject({ membershipId: uuidSchema });
export const membershipStatusInputSchema = z.strictObject({
  membershipId: uuidSchema,
  status: z.enum(["SUSPENDED", "REMOVED", "REVOKED"]),
});
export const membershipRoleInputSchema = z.strictObject({
  membershipId: uuidSchema,
  role: z.enum(["ADMIN", "MANAGER", "AGENT"]),
});
export const paginationInputSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10_000).default(0),
});

/** Reject unknown fields, including attempted UID, role and organization injection. */
export function validateInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new WorkspaceError("INVALID_INPUT", 400, "Check the supplied details and try again.");
  }
  return result.data;
}
