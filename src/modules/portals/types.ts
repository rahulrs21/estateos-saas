/**
 * Provider-independent portal export types. Enum values are plain strings so
 * the pure export pipeline can run (and be tested) without the generated SDK.
 */
export const portalProviders = ["PROPERTY_FINDER", "BAYUT", "DUBIZZLE"] as const;
export type PortalProviderCode = typeof portalProviders[number];

export const portalConnectionStatuses = ["NOT_CONFIGURED", "PENDING_APPROVAL", "CONNECTED", "ERROR", "DISABLED"] as const;
export type PortalConnectionStatusCode = typeof portalConnectionStatuses[number];
/** Statuses an administrator may record. CONNECTED/ERROR need server verification. */
export const adminSettableConnectionStatuses = ["NOT_CONFIGURED", "PENDING_APPROVAL", "DISABLED"] as const;

export const feedFormats = ["JSON", "XML"] as const;
export type FeedFormatCode = typeof feedFormats[number];

/** Value-mapping keys a company may override per provider. */
export const portalMappingKeys = ["PROPERTY_TYPE", "LISTING_PURPOSE", "FURNISHING", "EMIRATE", "AGENT_ID"] as const;
export type PortalMappingKey = typeof portalMappingKeys[number];

export type FieldMappingRow = {provider: string; fieldKey: string; sourceValue: string; targetValue: string};

/** Listing data as selected by the export queries (already tenant-scoped). */
export type ExportListingRow = {
  id: string; listingReference: string; listingPurpose: string; marketType: string; title: string;
  description?: string | null; askingPriceMinor: string; currency: string; rentalPeriod?: string | null;
  listingStatus: string; advertisingPermitNumber?: string | null; permitExpiryDate?: string | null;
  permitVerificationUrl?: string | null; updatedAt: string; assignedMembershipId?: string | null;
  assignedMembership?: {id: string; role: string; status: string; userProfile?: {displayName: string} | null} | null;
  property: {
    id: string; propertyReference: string; propertyType: string; marketType: string; bedrooms?: number | null;
    bathrooms?: number | null; builtUpArea?: number | null; plotArea?: number | null; areaUnit: string;
    furnishedStatus?: string | null; parkingSpaces?: number | null; view?: string | null; emirate?: string | null;
    community?: string | null; area?: string | null; floorNumber?: number | null; occupancyStatus: string;
    inventoryStatus: string; archivedAt?: string | null; project?: {projectName: string} | null; building?: {name: string} | null;
    inventoryMedias_on_property: {id: string; mediaKind: string; fileName: string; contentType: string; isCover: boolean; sortOrder: number}[];
  };
};

export type NormalizedMedia = {id: string; kind: "PHOTO" | "FLOOR_PLAN"; fileName: string; contentType: string; isCover: boolean; order: number};

export type NormalizedListing = {
  listingId: string; listingReference: string; propertyReference: string;
  title: string; description: string | null; purpose: string; marketType: string; propertyType: string;
  listingStatus: string; inventoryStatus: string; propertyArchived: boolean;
  bedrooms: number | null; bathrooms: number | null;
  size: {builtUp: number | null; plot: number | null; unit: string};
  furnishing: string | null; parkingSpaces: number | null; view: string | null; occupancy: string; floorNumber: number | null;
  location: {emirate: string | null; community: string | null; area: string | null; project: string | null; building: string | null};
  price: {amountMinor: string; amount: string; currency: string; rentalPeriod: string | null};
  permit: {number: string | null; expiryDate: string | null; verificationUrl: string | null};
  agent: {membershipId: string; name: string | null; active: boolean} | null;
  media: NormalizedMedia[];
  updatedAt: string;
};

export type ValidationSeverity = "ERROR" | "WARNING";
export type ValidationIssue = {code: string; field: string; severity: ValidationSeverity; message: string};

export type PortalRecord = {[key: string]: PortalValue};
export type PortalValue = string | number | boolean | null | undefined | PortalRecord | PortalValue[];
