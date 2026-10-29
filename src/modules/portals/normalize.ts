import { canonicalUuid } from "../organizations/server/identifiers";
import type { ExportListingRow, NormalizedListing } from "./types";

/** Integer minor units (for example fils) to a fixed two-decimal string, without floating point. */
export function minorToDecimal(minor: string): string {
  if (!/^-?\d+$/.test(minor)) throw new Error("Price must be an integer minor-unit string.");
  const value = BigInt(minor);
  const negative = value < BigInt(0);
  const absolute = negative ? -value : value;
  const hundred = BigInt(100);
  const fraction = (absolute % hundred).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${absolute / hundred}.${fraction}`;
}

const trimmed = (value: string | null | undefined) => value?.trim() ? value.trim() : null;

/**
 * Converts a tenant-scoped listing row into the provider-independent shape.
 * Only public advertising fields are carried; brochures, documents, unit
 * numbers and internal property references never reach an adapter.
 */
export function normalizeListing(row: ExportListingRow): NormalizedListing {
  const property = row.property;
  const agent = row.assignedMembership && row.assignedMembershipId ? {
    // Canonical form so AGENT_ID mappings (stored dashed) match SQL Connect's 32-hex output.
    membershipId: canonicalUuid(row.assignedMembershipId),
    name: trimmed(row.assignedMembership.userProfile?.displayName),
    active: row.assignedMembership.status === "ACTIVE",
  } : null;
  return {
    listingId: row.id, listingReference: row.listingReference, propertyReference: property.propertyReference,
    title: row.title.trim(), description: trimmed(row.description),
    purpose: row.listingPurpose, marketType: row.marketType, propertyType: property.propertyType,
    listingStatus: row.listingStatus, inventoryStatus: property.inventoryStatus, propertyArchived: Boolean(property.archivedAt),
    bedrooms: property.bedrooms ?? null, bathrooms: property.bathrooms ?? null,
    size: {builtUp: property.builtUpArea ?? null, plot: property.plotArea ?? null, unit: property.areaUnit},
    furnishing: property.furnishedStatus ?? null, parkingSpaces: property.parkingSpaces ?? null, view: trimmed(property.view),
    occupancy: property.occupancyStatus, floorNumber: property.floorNumber ?? null,
    location: {
      emirate: property.emirate ?? null, community: trimmed(property.community), area: trimmed(property.area),
      project: trimmed(property.project?.projectName), building: trimmed(property.building?.name),
    },
    price: {amountMinor: row.askingPriceMinor, amount: minorToDecimal(row.askingPriceMinor), currency: row.currency, rentalPeriod: row.rentalPeriod ?? null},
    permit: {number: trimmed(row.advertisingPermitNumber), expiryDate: row.permitExpiryDate ?? null, verificationUrl: trimmed(row.permitVerificationUrl)},
    agent,
    media: property.inventoryMedias_on_property
      .filter(media => media.mediaKind === "PROPERTY_PHOTO" || media.mediaKind === "FLOOR_PLAN")
      .map(media => ({id: media.id, kind: media.mediaKind === "FLOOR_PLAN" ? "FLOOR_PLAN" as const : "PHOTO" as const, fileName: media.fileName, contentType: media.contentType, isCover: media.isCover, order: media.sortOrder})),
    updatedAt: row.updatedAt,
  };
}
