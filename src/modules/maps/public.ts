import { describeLocation, presentMapLocation, type DisplayLocation } from "./geo";

/**
 * Public (unauthenticated) map data for future agency websites and landing
 * pages. Nothing here reads a session or tenant: the future public data source
 * resolves the agency from its own published-site configuration and passes raw
 * rows of that one company through these functions. They are allowlists. A
 * field reaches a public page only if it is copied here, so new CRM columns
 * never leak by default.
 *
 * Location rules (presentMapLocation with revealExact: false):
 * - EXACT: the approved stored point and its place ID.
 * - APPROXIMATE: the ~1 km grid-cell centre; no place ID, address or unit number.
 * - HIDDEN: no coordinates at all; only community and emirate text.
 * Street addresses and unit numbers are never public, in any mode, because they
 * would undo an approximate or hidden setting.
 */

export type PublicListingSource = {
  id: string; title: string; listingPurpose: string; listingStatus: string; publicationStatus: string;
  askingPriceMinor: string | number; currency: string; rentalPeriod?: string | null;
  advertisingPermitNumber?: string | null; permitExpiryDate?: string | null; archivedAt?: string | null;
  property: {
    propertyType: string; bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null; areaUnit?: string | null;
    emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
    latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
    archivedAt?: string | null;
  };
};

export type PublicListingPin = {
  id: string; title: string; purpose: "SALE" | "RENT"; price: {amountMinor: string; currency: string; rentalPeriod: string | null};
  propertyType: string; bedrooms: number | null; bathrooms: number | null; size: {value: number; unit: string} | null;
  locationText: string; location: DisplayLocation; advertisingPermitNumber: string; href: string | null;
};

export type PublicProjectSource = {
  id: string; projectName: string; projectStatus: string; archivedAt?: string | null;
  developer?: {name: string} | null; emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
  startingPriceMinor?: string | null; currency?: string | null; expectedHandoverDate?: string | null;
  buildings?: Array<{id: string; name: string; latitude?: number | null; longitude?: number | null}>;
};

export type PublicProjectMapData = {
  id: string; name: string; developerName: string | null; locationText: string; location: DisplayLocation;
  startingPrice: {amountMinor: string; currency: string} | null; expectedHandoverDate: string | null; href: string | null;
  buildings: Array<{id: string; name: string; location: DisplayLocation}>;
};

/**
 * A listing is public only when the company has explicitly published it
 * (publicationStatus PUBLISHED), it is ACTIVE, neither it nor its property is
 * archived, and it carries an unexpired advertising permit (UAE advertising
 * rules require the permit number on public adverts).
 */
export function isPublicListing(source: PublicListingSource, today = new Date().toISOString().slice(0, 10)) {
  return source.publicationStatus === "PUBLISHED" && source.listingStatus === "ACTIVE"
    && !source.archivedAt && !source.property.archivedAt
    && Boolean(source.advertisingPermitNumber?.trim())
    && (!source.permitExpiryDate || source.permitExpiryDate >= today);
}

function publicLocation(stored: {latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null}) {
  return presentMapLocation(stored, {revealExact: false}).display;
}

/** Returns null for anything that is not public, so callers cannot forget the eligibility check. */
export function toPublicListingPin(source: PublicListingSource, options: {href?: string | null; today?: string} = {}): PublicListingPin | null {
  if (!isPublicListing(source, options.today)) return null;
  const {property} = source;
  return {
    id: source.id,
    title: source.title,
    purpose: source.listingPurpose === "RENT" ? "RENT" : "SALE",
    price: {amountMinor: String(source.askingPriceMinor), currency: source.currency, rentalPeriod: source.rentalPeriod ?? null},
    propertyType: property.propertyType,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    size: property.builtUpArea != null && property.areaUnit ? {value: property.builtUpArea, unit: property.areaUnit} : null,
    locationText: describeLocation({community: property.community, city: property.city, emirate: property.emirate}),
    location: publicLocation(property),
    advertisingPermitNumber: source.advertisingPermitNumber!.trim(),
    href: options.href ?? null,
  };
}

export function toPublicListingPins(sources: PublicListingSource[], href?: (id: string) => string, today?: string) {
  return sources.flatMap(source => {
    const pin = toPublicListingPin(source, {href: href?.(source.id), today});
    return pin ? [pin] : [];
  });
}

/**
 * Public project map. Only ACTIVE or COMPLETED, unarchived projects are shown.
 * Building markers are included only when the project location is EXACT, and
 * they follow the project's mode.
 */
export function toPublicProjectMap(source: PublicProjectSource, options: {href?: string | null} = {}): PublicProjectMapData | null {
  if (source.archivedAt || !["ACTIVE", "COMPLETED"].includes(source.projectStatus)) return null;
  const location = publicLocation(source);
  return {
    id: source.id,
    name: source.projectName,
    developerName: source.developer?.name ?? null,
    locationText: describeLocation(source),
    location,
    startingPrice: source.startingPriceMinor ? {amountMinor: source.startingPriceMinor, currency: source.currency ?? "AED"} : null,
    expectedHandoverDate: source.expectedHandoverDate ?? null,
    href: options.href ?? null,
    buildings: location.precision === "EXACT"
      ? (source.buildings ?? []).flatMap(building => {
        const display = publicLocation({latitude: building.latitude, longitude: building.longitude, mapDisplayMode: "EXACT"});
        return display.precision === "NONE" ? [] : [{id: building.id, name: building.name, location: {...display, placeId: null}}];
      })
      : [],
  };
}
