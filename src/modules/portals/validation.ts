import type { NormalizedListing, ValidationIssue } from "./types";

export const residentialPropertyTypes = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE"];

export type ValidationRules = {
  /** Emirates where an advertising permit is treated as mandatory (Dubai: DLD/RERA permit). */
  permitRequiredEmirates: string[];
  /** Currencies the adapter can export. Assumption until provider specifications are verified. */
  currencies: string[];
  minimumPhotos: number;
  recommendedPhotos: number;
  recommendedDescriptionLength: number;
};

export type MappingLookup = (fieldKey: string, sourceValue: string) => string | undefined;

/** Calendar date in Dubai (UTC+4), used to compare permit expiry dates. */
export function dubaiDate(now: Date): string {
  return new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Common export readiness checks. Errors block a listing from being marked
 * READY; warnings are shown but do not block. Provider-specific rules come
 * from the adapter's configuration rather than separate code paths.
 */
export function validateListing(listing: NormalizedListing, rules: ValidationRules, mapping: MappingLookup, now: Date): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const error = (code: string, field: string, message: string) => issues.push({code, field, severity: "ERROR", message});
  const warning = (code: string, field: string, message: string) => issues.push({code, field, severity: "WARNING", message});

  if (listing.listingStatus !== "ACTIVE") error("LISTING_NOT_ACTIVE", "listingStatus", `Only ACTIVE listings can be exported. This listing is ${listing.listingStatus}.`);
  if (listing.propertyArchived) error("PROPERTY_ARCHIVED", "property", "The linked property is archived.");
  else if (listing.inventoryStatus !== "AVAILABLE") error("PROPERTY_UNAVAILABLE", "inventoryStatus", `The property must be AVAILABLE to advertise. It is ${listing.inventoryStatus}.`);

  if (!mapping("PROPERTY_TYPE", listing.propertyType)) error("PROPERTY_TYPE_UNMAPPED", "propertyType", `Property type ${listing.propertyType} has no mapping for this portal. Add a field mapping.`);
  if (!mapping("LISTING_PURPOSE", listing.purpose)) error("TRANSACTION_TYPE_UNMAPPED", "purpose", `Transaction type ${listing.purpose} has no mapping for this portal.`);
  if (listing.purpose === "RENT" && !listing.price.rentalPeriod) error("RENTAL_PERIOD_REQUIRED", "price.rentalPeriod", "Rental listings need a rental period.");

  if (BigInt(listing.price.amountMinor) <= BigInt(0)) error("PRICE_REQUIRED", "price.amount", "Enter an asking price greater than zero.");
  if (!rules.currencies.includes(listing.price.currency)) error("CURRENCY_UNSUPPORTED", "price.currency", `Currency ${listing.price.currency} is not supported. Use ${rules.currencies.join(" or ")}.`);

  if (!listing.location.emirate) error("EMIRATE_REQUIRED", "location.emirate", "Select the property's emirate.");
  else if (!mapping("EMIRATE", listing.location.emirate)) error("EMIRATE_UNMAPPED", "location.emirate", `Emirate ${listing.location.emirate} has no mapping for this portal.`);
  if (!listing.location.community) error("COMMUNITY_REQUIRED", "location.community", "Enter the property's community.");
  if (!listing.location.area) warning("AREA_RECOMMENDED", "location.area", "Add a sub-community or area to improve location matching.");

  const residential = residentialPropertyTypes.includes(listing.propertyType);
  if (residential && listing.bedrooms == null) error("BEDROOMS_REQUIRED", "bedrooms", "Residential listings need a bedroom count (use 0 for studio).");
  if (residential && listing.bathrooms == null) warning("BATHROOMS_RECOMMENDED", "bathrooms", "Add the number of bathrooms.");
  const size = listing.propertyType === "PLOT" ? listing.size.plot : listing.size.builtUp;
  if (!size || size <= 0) error("SIZE_REQUIRED", listing.propertyType === "PLOT" ? "size.plot" : "size.builtUp", listing.propertyType === "PLOT" ? "Enter the plot area." : "Enter the built-up area.");
  if (listing.furnishing && !mapping("FURNISHING", listing.furnishing)) warning("FURNISHING_UNMAPPED", "furnishing", `Furnishing ${listing.furnishing} has no mapping and will be omitted.`);

  const photos = listing.media.filter(media => media.kind === "PHOTO");
  if (photos.length < rules.minimumPhotos) error("PHOTOS_REQUIRED", "media", `Add at least ${rules.minimumPhotos} active property photo${rules.minimumPhotos === 1 ? "" : "s"}.`);
  else if (photos.length < rules.recommendedPhotos) warning("PHOTOS_RECOMMENDED", "media", `Listings with ${rules.recommendedPhotos} or more photos are recommended (currently ${photos.length}).`);
  if (photos.length && !photos.some(photo => photo.isCover)) warning("COVER_PHOTO_RECOMMENDED", "media", "Choose a cover photo; the first photo will be used.");

  if (!listing.agent) error("AGENT_REQUIRED", "agent", "Assign an agent to the listing.");
  else {
    if (!listing.agent.active) error("AGENT_INACTIVE", "agent", "The assigned agent's membership is not active.");
    if (!mapping("AGENT_ID", listing.agent.membershipId)) warning("AGENT_PORTAL_ID_MISSING", "agent.reference", "Map this agent to their portal agent identifier before publishing.");
  }

  const today = dubaiDate(now);
  const permitRequired = listing.location.emirate !== null && rules.permitRequiredEmirates.includes(listing.location.emirate);
  if (!listing.permit.number) {
    if (permitRequired) error("PERMIT_REQUIRED", "permit.number", "An advertising permit number is required for this emirate.");
    else warning("PERMIT_NOT_PROVIDED", "permit.number", "No advertising permit recorded. Confirm the emirate's advertising rules.");
  } else if (!listing.permit.expiryDate) warning("PERMIT_EXPIRY_MISSING", "permit.expiryDate", "Record the permit expiry date so expired permits can be detected.");
  else if (listing.permit.expiryDate < today) error("PERMIT_EXPIRED", "permit.expiryDate", `The advertising permit expired on ${listing.permit.expiryDate}.`);

  if (!listing.description) error("DESCRIPTION_REQUIRED", "description", "Add a listing description.");
  else if (listing.description.length < rules.recommendedDescriptionLength) warning("DESCRIPTION_SHORT", "description", `Descriptions of at least ${rules.recommendedDescriptionLength} characters are recommended.`);
  if (listing.title.length < 10) warning("TITLE_SHORT", "title", "Use a descriptive title of at least 10 characters.");
  return issues;
}

export const hasErrors = (issues: ValidationIssue[]) => issues.some(issue => issue.severity === "ERROR");
