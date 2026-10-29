import type { NormalizedListing, PortalProviderCode, PortalRecord } from "../types";
import type { MappingLookup, ValidationRules } from "../validation";

/**
 * Every adapter currently emits the internal "estateos-draft-v1" schema. No
 * provider specification has been verified, so element names and codes are
 * EstateOS placeholders, not official portal formats. When a provider supplies
 * its specification, replace that adapter's transform and mappings only.
 */
export const DRAFT_SCHEMA = "estateos-draft-v1";

export type PortalAdapter = {
  provider: PortalProviderCode;
  displayName: string;
  description: string;
  specificationStatus: "UNVERIFIED";
  supportedFormats: readonly ("JSON" | "XML")[];
  xml: {root: string; item: string};
  rules: ValidationRules;
  defaultMappings: Record<string, Record<string, string>>;
  transform(listing: NormalizedListing, mapping: MappingLookup): PortalRecord;
};

export const draftRules: ValidationRules = {
  permitRequiredEmirates: ["DUBAI"],
  currencies: ["AED"],
  minimumPhotos: 1,
  recommendedPhotos: 5,
  recommendedDescriptionLength: 100,
};

const lower = (values: string[]) => Object.fromEntries(values.map(value => [value, value.toLowerCase()]));

export const draftMappings: Record<string, Record<string, string>> = {
  PROPERTY_TYPE: lower(["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"]),
  LISTING_PURPOSE: {SALE: "sale", RENT: "rent"},
  FURNISHING: {FURNISHED: "furnished", SEMI_FURNISHED: "semi-furnished", UNFURNISHED: "unfurnished"},
  EMIRATE: lower(["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"]),
};

/** Shared draft transformation. Values pass through the company/adapter mapping lookup. */
export function draftTransform(provider: PortalProviderCode, listing: NormalizedListing, mapping: MappingLookup): PortalRecord {
  const photos = listing.media.filter(media => media.kind === "PHOTO");
  const cover = photos.find(photo => photo.isCover) ?? photos[0];
  return {
    schema: DRAFT_SCHEMA,
    provider,
    reference: listing.listingReference,
    purpose: mapping("LISTING_PURPOSE", listing.purpose),
    propertyType: mapping("PROPERTY_TYPE", listing.propertyType),
    marketType: listing.marketType.toLowerCase(),
    title: listing.title,
    description: listing.description,
    price: {
      amount: listing.price.amount,
      currency: listing.price.currency,
      period: listing.purpose === "RENT" && listing.price.rentalPeriod ? listing.price.rentalPeriod.toLowerCase() : null,
    },
    location: {
      emirate: listing.location.emirate ? mapping("EMIRATE", listing.location.emirate) : null,
      community: listing.location.community,
      area: listing.location.area,
      project: listing.location.project,
      building: listing.location.building,
    },
    details: {
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      size: listing.propertyType === "PLOT" ? listing.size.plot : listing.size.builtUp,
      plotSize: listing.propertyType === "PLOT" ? null : listing.size.plot,
      sizeUnit: listing.size.unit.toLowerCase(),
      furnishing: listing.furnishing ? mapping("FURNISHING", listing.furnishing) : null,
      parkingSpaces: listing.parkingSpaces,
      view: listing.view,
      floor: listing.floorNumber,
    },
    permit: {number: listing.permit.number, expiryDate: listing.permit.expiryDate},
    agent: listing.agent ? {reference: mapping("AGENT_ID", listing.agent.membershipId), name: listing.agent.name} : null,
    // Media are private Storage objects. URLs require an approved public media
    // delivery design, so only stable references and ordering are exported.
    media: [
      ...(cover ? [cover] : []), ...photos.filter(photo => photo !== cover), ...listing.media.filter(media => media.kind === "FLOOR_PLAN"),
    ].map((media, index) => ({reference: media.id, kind: media.kind === "PHOTO" ? "photo" : "floor_plan", cover: media === cover, position: index + 1})),
    updatedAt: listing.updatedAt,
  };
}

export function createDraftAdapter(provider: PortalProviderCode, displayName: string, description: string): PortalAdapter {
  return {
    provider, displayName, description, specificationStatus: "UNVERIFIED",
    supportedFormats: ["JSON", "XML"],
    xml: {root: "listings", item: "listing"},
    rules: draftRules,
    defaultMappings: draftMappings,
    transform: (listing, mapping) => draftTransform(provider, listing, mapping),
  };
}
