/** Deterministic suggestions over already-authorized inventory; this is not an access policy. */
export interface PropertyPreferences {
  preferredLocation?: string | null;
  propertyType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  currency?: string;
  bedroomPreference?: string | null;
  transactionType?: "BUY" | "RENT" | "INVEST";
  projectId?: string | null;
}

export interface MatchingProperty {
  id: string;
  propertyReference: string;
  projectId?: string | null;
  project?: {id: string; projectName: string} | null;
  propertyType: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  builtUpArea?: number | null;
  areaUnit?: string | null;
  emirate?: string | null;
  community?: string | null;
  area?: string | null;
  inventoryStatus: string;
  archivedAt?: string | null;
  propertyListings_on_property: {
    id: string; listingPurpose: string; title: string; askingPriceMinor: string;
    currency: string; rentalPeriod?: string | null; listingStatus: string;
  }[];
}

const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const sameId = (a: string, b: string) => a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();
export function bedroomRule(value?: string | null): {minimum: number; exact: boolean} | null | "INVALID" {
  if (!value?.trim()) return null;
  if (normalize(value) === "studio") return {minimum: 0, exact: true};
  const match = value.trim().match(/^(\d{1,2})(\+)?(?:\s*(?:bed|beds|bedroom|bedrooms))?$/i);
  return match ? {minimum: Number(match[1]), exact: !match[2]} : "INVALID";
}

export function matchProperty(preferences: PropertyPreferences, property: MatchingProperty) {
  if (property.archivedAt || property.inventoryStatus !== "AVAILABLE") return null;
  const reasons = ["Available inventory"];
  if (preferences.projectId) {
    if (!property.projectId || !sameId(preferences.projectId, property.projectId)) return null;
    reasons.push(`Interested project: ${property.project?.projectName ?? "linked project"}`);
  }
  if (preferences.preferredLocation?.trim()) {
    const location = normalize([property.emirate, property.community, property.area, property.project?.projectName].filter(Boolean).join(" "));
    const locationWords = new Set(location.split(" "));
    if (!normalize(preferences.preferredLocation).split(" ").every(part => locationWords.has(part))) return null;
    reasons.push(`Location matches ${preferences.preferredLocation.trim()}`);
  }
  if (preferences.propertyType?.trim()) {
    if (normalize(preferences.propertyType) !== normalize(property.propertyType)) return null;
    reasons.push(`Property type: ${property.propertyType.replaceAll("_", " ").toLowerCase()}`);
  }
  const bedrooms = bedroomRule(preferences.bedroomPreference);
  if (bedrooms === "INVALID") return null;
  if (bedrooms) {
    if (property.bedrooms == null || (bedrooms.exact ? property.bedrooms !== bedrooms.minimum : property.bedrooms < bedrooms.minimum)) return null;
    reasons.push(bedrooms.minimum === 0 ? "Studio" : `${property.bedrooms} bedrooms match ${preferences.bedroomPreference}`);
  }
  const isRent = preferences.transactionType === "RENT";
  const currency = preferences.currency ?? "AED";
  const eligible = property.propertyListings_on_property.flatMap(listing => {
    if (listing.listingStatus !== "ACTIVE" || listing.listingPurpose !== (isRent ? "RENT" : "SALE") || listing.currency !== currency || !/^\d+$/.test(listing.askingPriceMinor)) return [];
    if (isRent && !["MONTHLY", "YEARLY"].includes(listing.rentalPeriod ?? "")) return [];
    const comparablePrice = BigInt(listing.askingPriceMinor) * (isRent && listing.rentalPeriod === "MONTHLY" ? BigInt(12) : BigInt(1));
    if (preferences.budgetMin != null && comparablePrice < BigInt(Math.round(preferences.budgetMin * 100))) return [];
    if (preferences.budgetMax != null && comparablePrice > BigInt(Math.round(preferences.budgetMax * 100))) return [];
    return [{listing, comparablePrice}];
  }).sort((a, b) => a.comparablePrice < b.comparablePrice ? -1 : a.comparablePrice > b.comparablePrice ? 1 : a.listing.id.localeCompare(b.listing.id));
  if (!eligible.length) return null;
  const {listing} = eligible[0];
  reasons.push(isRent ? "Active rental listing; budget compared with annual rent" : preferences.transactionType === "INVEST" ? "Active sale listing for investment" : "Active sale listing");
  reasons.push(preferences.budgetMin != null || preferences.budgetMax != null ? `Within the ${currency} budget` : `Price quoted in ${currency}; no budget limit set`);
  if (isRent && listing.rentalPeriod === "MONTHLY") reasons.push("Monthly rent multiplied by 12; fees excluded");
  return {property, listing, reasons};
}
