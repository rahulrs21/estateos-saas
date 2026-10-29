import { z } from "zod";
import { canonicalUuid } from "../organizations/server/identifiers";
import { uuidSchema } from "../organizations/server/validation";
import { adminSettableConnectionStatuses, feedFormats, portalMappingKeys, portalProviders } from "./types";

const optionalText = (max: number) => z.string().trim().max(max).transform(value => value || null).nullable().optional();
export const portalProviderSchema = z.enum(portalProviders);

// No credential fields exist: strict objects reject API keys or secrets sent by a client.
export const savePortalConnectionSchema = z.strictObject({
  provider: portalProviderSchema,
  status: z.enum(adminSettableConnectionStatuses, {error: "Choose Not configured, Pending approval or Disabled. Connected requires a verified integration."}),
  accountReference: optionalText(120),
  notes: optionalText(1000),
  expectedUpdatedAt: z.iso.datetime({offset: true}).nullable().optional(),
});
export const setPortalFieldMappingSchema = z.strictObject({
  provider: portalProviderSchema,
  fieldKey: z.enum(portalMappingKeys),
  sourceValue: z.string().trim().min(1, "Enter the EstateOS value.").max(120),
  targetValue: z.string().trim().min(1, "Enter the portal value.").max(120),
}).superRefine((value, context) => {
  if (value.fieldKey === "AGENT_ID" && !uuidSchema.safeParse(value.sourceValue).success) {
    context.addIssue({code: "custom", path: ["sourceValue"], message: "Choose an agent from your company."});
  }
}).transform(value => value.fieldKey === "AGENT_ID" ? {...value, sourceValue: canonicalUuid(value.sourceValue)} : value);
export const removePortalFieldMappingSchema = z.strictObject({id: uuidSchema});
export const portalPreviewSchema = z.strictObject({listingId: uuidSchema, provider: portalProviderSchema});
export const recordListingValidationSchema = portalPreviewSchema;
export const feedDryRunSchema = z.strictObject({provider: portalProviderSchema, format: z.enum(feedFormats)});
