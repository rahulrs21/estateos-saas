import { z } from "zod";
import { uuidSchema, validateInput, paginationInputSchema } from "../organizations/server/validation";
import { isWithinUae, mapDisplayModes } from "../maps/geo";
import { googlePlaceIdSchema } from "../maps/validation";

const text = (max: number, min = 1) => z.string().trim().min(min).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const webUrl = z.url({protocol: /^https?$/}).max(2048).nullable().optional();
const date = z.iso.date().nullable().optional();
const currency = z.string().regex(/^[A-Z]{3}$/);
const moneyMinor = z.string().regex(/^\d{1,18}$/, "Use an integer amount in minor currency units.").nullable().optional();
const latitude = z.number().finite().min(-90).max(90).nullable().optional();
const longitude = z.number().finite().min(-180).max(180).nullable().optional();
const city = z.string().trim().max(120).nullable().optional();
const googlePlaceId = googlePlaceIdSchema.nullable().optional();
const mapDisplayMode = z.enum(mapDisplayModes);
type Coordinates = {latitude?: number | null; longitude?: number | null};
const coordinatePair = (value: Coordinates) => (value.latitude == null) === (value.longitude == null);
const coordinatePairIssue = {message: "Provide both location coordinates or leave both blank.", path: ["latitude"]};
const uaeIssue = {message: "Coordinates must be inside the United Arab Emirates. Check that latitude and longitude are not swapped.", path: ["latitude"]};
/** True when no point is recorded or the point is inside the UAE bounding box. */
export const coordinatesWithinUae = (value: Coordinates) => value.latitude == null || value.longitude == null || isWithinUae(value.latitude, value.longitude);

export const inventoryResourceSchema = z.enum([
  "developers", "projects", "phases", "buildings", "properties", "listings",
  "floor-plans", "payment-plans", "amenities", "features",
]);
export type InventoryResource = z.infer<typeof inventoryResourceSchema>;

/** Listing list orders; each maps to a fixed orderBy in the stored list operations. */
export const listingSorts = ["UPDATED_DESC", "CREATED_DESC", "PRICE_ASC", "PRICE_DESC"] as const;
export type ListingSort = (typeof listingSorts)[number];
export const listingViews = ["table", "cards", "map"] as const;
export type ListingView = (typeof listingViews)[number];
export const parseListingView = (value: string | undefined): ListingView => (listingViews as readonly string[]).includes(value ?? "") ? value as ListingView : "table";
export const parseListingSort = (value: string | undefined): ListingSort => (listingSorts as readonly string[]).includes(value ?? "") ? value as ListingSort : "UPDATED_DESC";

/**
 * Listing workflow. Agents may move their own listings between DRAFT and
 * PENDING_REVIEW; every other step is OWNER/ADMIN only. The stored mutations
 * enforce the same matrix.
 */
export const listingTransitions: Record<string, readonly string[]> = {
  DRAFT: ["PENDING_REVIEW", "ARCHIVED"],
  PENDING_REVIEW: ["DRAFT", "APPROVED", "PAUSED", "ARCHIVED"],
  APPROVED: ["ACTIVE", "PAUSED", "ARCHIVED"],
  ACTIVE: ["PAUSED", "CLOSED", "ARCHIVED"],
  PAUSED: ["ACTIVE", "CLOSED", "ARCHIVED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
  // Legacy states remain readable during migration and may only move to the
  // new workflow's closed/archived terminal states.
  UNDER_OFFER: ["CLOSED", "ARCHIVED"], SOLD: ["CLOSED", "ARCHIVED"],
  RENTED: ["CLOSED", "ARCHIVED"], WITHDRAWN: ["ARCHIVED"], EXPIRED: ["ARCHIVED"],
};
export const agentListingStatuses: readonly string[] = ["DRAFT", "PENDING_REVIEW"];

/** Next statuses this viewer may choose for a listing (empty when none). */
export function allowedListingTransitions(current: string, role: string, isAssignedAgent: boolean): string[] {
  const next = listingTransitions[current] ?? [];
  if (role === "OWNER" || role === "ADMIN") return [...next];
  if (role === "AGENT" && isAssignedAgent) return next.filter(status => agentListingStatuses.includes(status));
  return [];
}

export const listingStatusInputSchema = z.strictObject({
  expectedStatus: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED", "UNDER_OFFER", "SOLD", "RENTED", "WITHDRAWN", "EXPIRED"]),
  status: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"]),
});

export const inventoryPageSchema = paginationInputSchema.extend({
  search: z.string().trim().max(120).optional(),
  developerId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  phaseId: uuidSchema.optional(),
  buildingId: uuidSchema.optional(),
  propertyId: uuidSchema.optional(),
  assignedMembershipId: uuidSchema.optional(),
  status: z.string().max(40).optional(),
  projectStatus: z.string().max(40).optional(),
  emirate: z.enum(["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"]).optional(),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"]).optional(),
  inventoryStatus: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"]).optional(),
  listingStatus: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED", "UNDER_OFFER", "SOLD", "RENTED", "WITHDRAWN", "EXPIRED"]).optional(),
  purpose: z.enum(["SALE", "RENT"]).optional(),
  marketType: z.enum(["OFF_PLAN", "SECONDARY"]).optional(),
  community: z.string().trim().max(160).optional(),
  bedrooms: z.coerce.number().int().min(0).max(100).optional(),
  minimumPriceMinor: z.string().regex(/^\d{1,18}$/).optional(),
  maximumPriceMinor: z.string().regex(/^\d{1,18}$/).optional(),
  sort: z.enum(listingSorts).optional(),
}).refine(value => !value.minimumPriceMinor || !value.maximumPriceMinor || BigInt(value.minimumPriceMinor) <= BigInt(value.maximumPriceMinor), {
  message: "Minimum price cannot be greater than maximum price.", path: ["maximumPriceMinor"],
});

export type PropertyListPageInput = {
  search?: string; projectId?: string; developerId?: string; community?: string; propertyType?: string;
  bedrooms?: string; minimumPrice?: string; maximumPrice?: string; inventoryStatus?: string;
  assignedMembershipId?: string; buildingId?: string; marketType?: string; emirate?: string; page: number;
};

/** Convert a major-unit filter amount to minor units; invalid text is passed through for strict validation to reject. */
function toMinor(value?: string) {
  if (!value) return undefined;
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) return value;
  const [whole, fraction = ""] = value.split(".");
  return (BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2))).toString();
}

/** Translate UI filters to the strict stored-operation input; never pass view-only fields like `page`. */
export function buildPropertyListOperationInput(input: PropertyListPageInput) {
  return {
    search: input.search,
    projectId: input.projectId,
    developerId: input.developerId,
    community: input.community,
    propertyType: input.propertyType,
    bedrooms: input.bedrooms,
    minimumPriceMinor: toMinor(input.minimumPrice),
    maximumPriceMinor: toMinor(input.maximumPrice),
    inventoryStatus: input.inventoryStatus,
    assignedMembershipId: input.assignedMembershipId,
    buildingId: input.buildingId,
    marketType: input.marketType,
    emirate: input.emirate,
    limit: 25,
    offset: (input.page - 1) * 25,
  };
}

export type ListingListPageInput = {
  search?: string; listingStatus?: string; purpose?: string; marketType?: string; emirate?: string;
  community?: string; propertyType?: string; minimumPrice?: string; maximumPrice?: string; sort?: string; page: number;
};

export function buildListingListOperationInput(input: ListingListPageInput) {
  return {
    search: input.search, listingStatus: input.listingStatus, purpose: input.purpose, marketType: input.marketType,
    emirate: input.emirate, community: input.community, propertyType: input.propertyType,
    minimumPriceMinor: toMinor(input.minimumPrice), maximumPriceMinor: toMinor(input.maximumPrice),
    sort: input.sort && input.sort !== "UPDATED_DESC" ? parseListingSort(input.sort) : undefined,
    limit: 25, offset: (input.page - 1) * 25,
  };
}

export const developerInputSchema = z.strictObject({
  name: text(160, 2),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  logoReference: webUrl,
  description: optionalText(4000),
  website: webUrl,
  email: z.email().trim().toLowerCase().max(254).nullable().optional(),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,32}$/).nullable().optional(),
  country: z.string().regex(/^[A-Z]{2}$/).default("AE"),
  headOfficeAddress: optionalText(1000),
  headOfficeLatitude: latitude, headOfficeLongitude: longitude, headOfficeGooglePlaceId: googlePlaceId,
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
}).refine(value => coordinatePair({latitude: value.headOfficeLatitude, longitude: value.headOfficeLongitude}), {...coordinatePairIssue, path: ["headOfficeLatitude"]})
  .refine(value => value.country !== "AE" || coordinatesWithinUae({latitude: value.headOfficeLatitude, longitude: value.headOfficeLongitude}), {...uaeIssue, path: ["headOfficeLatitude"]});

export const projectInputSchema = z.strictObject({
  developerId: uuidSchema,
  projectName: text(180, 2),
  projectCode: text(80),
  description: optionalText(4000),
  projectType: z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"]),
  ownershipType: z.enum(["FREEHOLD", "LEASEHOLD", "SHARED_OWNERSHIP"]).nullable().optional(),
  community: optionalText(160), area: optionalText(160),
  emirate: z.enum(["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"]).nullable().optional(),
  country: z.string().regex(/^[A-Z]{2}$/).default("AE"),
  address: optionalText(1000), latitude, longitude, city, googlePlaceId, mapDisplayMode: mapDisplayMode.default("EXACT"),
  launchDate: date, expectedHandoverDate: date, actualHandoverDate: date,
  constructionStatus: z.enum(["PLANNING", "LAUNCHED", "UNDER_CONSTRUCTION", "COMPLETED", "ON_HOLD"]).default("PLANNING"),
  projectStatus: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"]).default("DRAFT"),
  startingPriceMinor: moneyMinor, currency: currency.default("AED"),
  totalUnits: z.number().int().min(0).max(2_000_000).nullable().optional(),
  marketingDescription: optionalText(4000), brochureReference: webUrl, permitNumber: optionalText(120), permitExpiryDate: date,
  permitReferenceUrl: webUrl,
}).refine(coordinatePair, coordinatePairIssue)
  .refine(value => value.country !== "AE" || coordinatesWithinUae(value), uaeIssue);

export const phaseInputSchema = z.strictObject({
  projectId: uuidSchema, name: text(160, 2), reference: optionalText(80), description: optionalText(2000),
  status: z.enum(["PLANNED", "UNDER_CONSTRUCTION", "COMPLETED", "ON_HOLD"]).default("PLANNED"),
  expectedHandoverDate: date, actualHandoverDate: date,
});

export const buildingInputSchema = z.strictObject({
  projectId: uuidSchema, phaseId: uuidSchema.nullable().optional(), name: text(160, 2), reference: optionalText(80),
  floors: z.number().int().min(0).max(300).nullable().optional(),
  buildingType: z.enum(["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "TOWNHOUSE", "VILLA", "OTHER"]),
  status: z.enum(["PLANNED", "UNDER_CONSTRUCTION", "COMPLETED", "ON_HOLD"]).default("PLANNED"),
  handoverDate: date, latitude, longitude,
}).refine(coordinatePair, coordinatePairIssue);

export const propertyInputSchema = z.strictObject({
  propertyReference: text(80), projectId: uuidSchema.nullable().optional(), buildingId: uuidSchema.nullable().optional(), unitNumber: optionalText(80),
  marketType: z.enum(["OFF_PLAN", "SECONDARY"]).default("SECONDARY"),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"]),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(), bathrooms: z.number().finite().min(0).max(100).nullable().optional(),
  floorNumber: z.number().int().min(0).max(300).nullable().optional(),
  builtUpArea: z.number().finite().positive().max(100_000_000).nullable().optional(), plotArea: z.number().finite().positive().max(100_000_000).nullable().optional(),
  areaUnit: z.enum(["SQFT", "SQM"]).default("SQFT"), furnishedStatus: z.enum(["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"]).nullable().optional(),
  parkingSpaces: z.number().int().min(0).max(1000).nullable().optional(), view: optionalText(120),
  emirate: z.enum(["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"]).nullable().optional(),
  community: optionalText(160), area: optionalText(160), address: optionalText(1000), latitude, longitude,
  city, googlePlaceId, mapDisplayMode: mapDisplayMode.default("APPROXIMATE"),
  referencePriceMinor: moneyMinor, internalNotes: optionalText(4000), ownershipReference: optionalText(160), mandateReference: optionalText(160),
  assignedMembershipId: uuidSchema.nullable().optional(),
  occupancyStatus: z.enum(["VACANT", "OCCUPIED", "TENANTED", "UNDER_CONSTRUCTION"]).default("VACANT"),
  inventoryStatus: z.enum(["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"]).default("DRAFT"),
}).refine((value) => !value.buildingId || !!value.projectId, { message: "A building requires a project." })
  .refine(coordinatePair, coordinatePairIssue)
  .refine(coordinatesWithinUae, uaeIssue);

export const listingInputSchema = z.strictObject({
  propertyId: uuidSchema, listingReference: text(80), listingPurpose: z.enum(["SALE", "RENT"]), marketType: z.enum(["OFF_PLAN", "SECONDARY"]),
  title: text(180, 2), description: optionalText(4000), askingPriceMinor: z.string().regex(/^\d{1,18}$/), currency: currency.default("AED"),
  rentalPeriod: z.enum(["MONTHLY", "YEARLY"]).nullable().optional(), assignedMembershipId: uuidSchema.nullable().optional(),
  listingStatus: z.enum(["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED", "UNDER_OFFER", "SOLD", "RENTED", "WITHDRAWN", "EXPIRED"]).default("DRAFT"),
  publicationStatus: z.enum(["NOT_PUBLISHED", "READY"]).default("NOT_PUBLISHED"),
  advertisingPermitNumber: optionalText(120), permitExpiryDate: date,
  permitVerificationUrl: webUrl,
}).refine((value) => value.listingPurpose === "RENT" ? !!value.rentalPeriod : value.rentalPeriod == null,
  { message: "Rental listings require a rental period; sale listings cannot have one." });

export const floorPlanInputSchema = z.strictObject({
  projectId: uuidSchema, propertyId: uuidSchema.nullable().optional(), buildingId: uuidSchema.nullable().optional(), name: text(160, 2),
  propertyType: z.enum(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"]),
  bedrooms: z.number().int().min(0).max(100).nullable().optional(),
  builtUpArea: z.number().finite().positive().max(100_000_000).nullable().optional(), plotArea: z.number().finite().positive().max(100_000_000).nullable().optional(),
  areaUnit: z.enum(["SQFT", "SQM"]).default("SQFT"), mediaReference: webUrl,
});

export const paymentPlanInputSchema = z.strictObject({
  projectId: uuidSchema, propertyId: uuidSchema.nullable().optional(), name: text(160, 2), bookingPercentageBps: z.number().int().min(0).max(10000),
  handoverPercentageBps: z.number().int().min(0).max(10000),
}).refine((value) => value.bookingPercentageBps + value.handoverPercentageBps <= 10000,
  { message: "Booking and handover percentages cannot exceed 100%." });

export const paymentInstallmentInputSchema = z.strictObject({
  position: z.number().int().min(0).max(23), percentageBps: z.number().int().min(1).max(10000),
  dueTrigger: z.enum(["CONSTRUCTION_MILESTONE", "HANDOVER", "POST_HANDOVER"]),
  constructionMilestonePercent: z.number().int().min(1).max(100).nullable().optional(),
  postHandoverMonths: z.number().int().min(1).max(600).nullable().optional(),
  description: optionalText(240),
}).refine((value) => {
  if (value.dueTrigger === "CONSTRUCTION_MILESTONE") return value.constructionMilestonePercent != null && value.postHandoverMonths == null;
  if (value.dueTrigger === "POST_HANDOVER") return value.postHandoverMonths != null && value.constructionMilestonePercent == null;
  return value.constructionMilestonePercent == null && value.postHandoverMonths == null;
}, { message: "Installment details must match its due trigger." });
export const paymentPlanCreateSchema = paymentPlanInputSchema.extend({
  installments: z.array(paymentInstallmentInputSchema).min(1).max(24),
}).refine((value) => value.bookingPercentageBps + value.handoverPercentageBps + value.installments.reduce((sum, installment) => sum + installment.percentageBps, 0) === 10000,
  { message: "Booking, installments, and handover must total exactly 100%." });
export const paymentPlanActivationSchema = z.strictObject({ isActive: z.boolean() });
export const paymentPlanIdSchema = z.strictObject({ paymentPlanId: uuidSchema });
export const featureUpdateSchema = z.strictObject({
  valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN"]), textValue: optionalText(500),
  numberValue: z.number().finite().nullable().optional(), booleanValue: z.boolean().nullable().optional(), unit: optionalText(40),
}).refine((value) => {
  const values = [value.textValue != null, value.numberValue != null, value.booleanValue != null];
  const count = values.filter(Boolean).length;
  return count === 1 && ((value.valueType === "TEXT" && values[0]) || (value.valueType === "NUMBER" && values[1]) || (value.valueType === "BOOLEAN" && values[2]));
}, { message: "Provide exactly one feature value that matches its type." });

export const amenityInputSchema = z.strictObject({ name: text(120, 2), category: optionalText(80) });
export const featureInputSchema = z.strictObject({
  propertyId: uuidSchema, key: z.string().trim().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN"]), textValue: optionalText(500),
  numberValue: z.number().finite().nullable().optional(), booleanValue: z.boolean().nullable().optional(), unit: optionalText(40),
}).refine((value) => {
  const values = [value.textValue != null, value.numberValue != null, value.booleanValue != null];
  const count = values.filter(Boolean).length;
  return count === 1 && ((value.valueType === "TEXT" && values[0]) || (value.valueType === "NUMBER" && values[1]) || (value.valueType === "BOOLEAN" && values[2]));
}, { message: "Provide exactly one feature value that matches its type." });
export const propertyFeatureLabelsSchema = z.array(z.string().trim().min(2).max(120)).max(30);

export const inventoryMediaUploadSchema = z.strictObject({
  parentType: z.enum(["properties", "projects", "floor-plans"]),
  parentId: uuidSchema,
  fileName: text(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  byteSize: z.number().int().positive().max(20 * 1024 * 1024),
  mediaKind: z.enum(["PROPERTY_PHOTO", "FLOOR_PLAN", "BROCHURE", "DOCUMENT"]),
}).refine(({parentType, mediaKind, contentType}) => {
  const image = contentType.startsWith("image/");
  if (mediaKind === "PROPERTY_PHOTO") return parentType === "properties" && image;
  if (mediaKind === "DOCUMENT") return contentType === "application/pdf";
  if (mediaKind === "FLOOR_PLAN") return ["properties", "projects", "floor-plans"].includes(parentType);
  return parentType === "properties" || parentType === "projects";
}, {message: "Choose a file type and media category that match the selected inventory record."});

export const inventoryIdSchema = z.strictObject({ id: uuidSchema });

export function parseInventory<T>(schema: z.ZodType<T>, input: unknown): T {
  return validateInput(schema, input);
}

export function normalizeInventorySearch(value: string | undefined): string | undefined {
  return value?.replace(/[\\%_]/g, "\\$&");
}
