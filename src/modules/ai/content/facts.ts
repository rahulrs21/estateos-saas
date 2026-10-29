import { canonicalUuid } from "../../organizations/server/identifiers";
import { areaText, cleanText, emirateName, formatMoney, humanize, minorToMajor, money, presentLocation } from "../tools/present";
import { listingPrice } from "../tools/records";
import type { SourceKind } from "./catalog";

/**
 * The verified factual context for one generation (docs/AI_CONTENT_SECURITY.md).
 * Presenters here are allowlists over records already returned by the
 * permission-checked CRM services: they never copy contact details, internal
 * notes, ownership or mandate references, coordinates, place IDs, media file
 * names or member email addresses. Record text is untrusted and is cleaned
 * and length-capped. Branding and user instructions are kept separate.
 */

export interface SourceRef { kind: SourceKind | "developer"; id: string; reference: string | null; updatedAt: string | null }

export interface PropertyRecord {
  id: string; propertyReference: string; propertyType: string; marketType?: string | null; bedrooms?: number | null; bathrooms?: number | null;
  floorNumber?: number | null; builtUpArea?: number | null; plotArea?: number | null; areaUnit?: string | null; furnishedStatus?: string | null;
  parkingSpaces?: number | null; view?: string | null; emirate?: string | null; city?: string | null; community?: string | null; area?: string | null;
  address?: string | null; mapDisplayMode?: string | null; referencePriceMinor?: string | number | null; occupancyStatus?: string | null; inventoryStatus: string;
  unitNumber?: string | null; updatedAt?: string | null;
  project?: {id: string; projectName: string; developer?: {id?: string; name: string} | null} | null;
  building?: {name: string} | null;
  propertyAmenities_on_property?: Array<{amenity?: {name: string; category?: string | null} | null}>;
  propertyFeatures_on_property?: Array<{key: string; valueType: string; textValue?: string | null; numberValue?: number | null; booleanValue?: boolean | null; unit?: string | null}>;
}

export interface ListingRecord {
  id: string; listingReference: string; listingPurpose: string; marketType?: string | null; title: string; description?: string | null;
  askingPriceMinor: string; currency: string; rentalPeriod?: string | null; listingStatus: string; advertisingPermitNumber?: string | null;
  permitExpiryDate?: string | null; updatedAt?: string | null;
  property: {
    id: string; propertyReference: string; propertyType: string; bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null; plotArea?: number | null;
    areaUnit?: string | null; emirate?: string | null; city?: string | null; community?: string | null; area?: string | null; mapDisplayMode?: string | null;
    inventoryStatus?: string | null; project?: {id: string; projectName: string} | null; building?: {name: string} | null;
  };
}

export interface ProjectRecord {
  id: string; projectName: string; projectCode?: string | null; description?: string | null; marketingDescription?: string | null; projectType?: string | null;
  ownershipType?: string | null; community?: string | null; area?: string | null; emirate?: string | null; city?: string | null; address?: string | null;
  mapDisplayMode?: string | null; launchDate?: string | null; expectedHandoverDate?: string | null; actualHandoverDate?: string | null; constructionStatus?: string | null;
  projectStatus: string; startingPriceMinor?: string | number | null; currency?: string | null; totalUnits?: number | null; permitNumber?: string | null; updatedAt?: string | null;
  developer?: {id: string; name: string} | null;
  projectPhases_on_project?: Array<{name: string; status?: string | null; expectedHandoverDate?: string | null; actualHandoverDate?: string | null}>;
  projectAmenities_on_project?: Array<{amenity?: {name: string} | null}>;
}

export interface PaymentPlanRecord {
  name: string; isActive: boolean; bookingPercentageBps?: number | null; handoverPercentageBps?: number | null;
  paymentPlanInstallments_on_paymentPlan?: Array<{position: number; percentageBps: number; dueTrigger: string; constructionMilestonePercent?: number | null; postHandoverMonths?: number | null; description?: string | null}>;
}

export interface UnitRecord { propertyType: string; bedrooms?: number | null; referencePriceMinor?: string | number | null }

export interface DeveloperRecord { id: string; name: string; description?: string | null; website?: string | null; updatedAt?: string | null }

export interface LeadRecord {
  id: string; fullName: string; status: string; transactionType: string; propertyType?: string | null; bedroomPreference?: string | null;
  preferredLocation?: string | null; updatedAt?: string | null; contact?: {fullName: string} | null;
}

export interface LeadPropertyRecord {
  viewings: Array<{propertyId: string; scheduledAt: string; status: string; customerConfirmation?: string | null; property: {propertyReference: string; community?: string | null; emirate?: string | null}}>;
  shortlist: Array<{propertyId: string; status: string; property: {propertyReference: string}}>;
}

export interface BrandRecord {
  companyName: string;
  companyPhone?: string | null; companyEmail?: string | null;
  profile?: {
    displayName?: string | null; brandTone?: string | null; useCompanyPhone?: boolean; useCompanyEmail?: boolean; website?: string | null;
    whatsappNumber?: string | null; defaultCallToAction?: string | null; tagline?: string | null; marketingDisclaimer?: string | null;
  } | null;
}

export interface ApprovedBranding {
  companyName: string;
  tagline: string | null;
  brandTone: string | null;
  defaultCallToAction: string | null;
  marketingDisclaimer: string | null;
  approvedContacts: {phone: string | null; email: string | null; website: string | null; whatsapp: string | null};
}

export interface FactSheet {
  /** ISO time the facts were read. */
  readAt: string;
  sender: {name: string | null; note: string};
  properties: Array<ReturnType<typeof presentPropertyFacts> & {listings?: Array<ReturnType<typeof presentRelatedListing>> | string}>;
  listings: Array<ReturnType<typeof presentListingFacts>>;
  project: ReturnType<typeof presentProjectFacts> | null;
  developer: ReturnType<typeof presentDeveloperFacts> | null;
  lead: ReturnType<typeof presentLeadFacts> | null;
  /** Sections that exist but could not be read with the user's permissions. */
  unavailable: string[];
}

const dubaiTime = (iso: string) => new Intl.DateTimeFormat("en-GB", {timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true}).format(new Date(iso));
const percent = (bps: number | null | undefined) => bps == null ? null : `${(bps / 100).toLocaleString("en-US", {maximumFractionDigits: 2})}%`;
const dateOnly = (value: string | null | undefined) => value ? value.slice(0, 10) : null;

export function presentBranding(record: BrandRecord): ApprovedBranding {
  const profile = record.profile ?? null;
  return {
    companyName: cleanText(profile?.displayName, 160) ?? cleanText(record.companyName, 160) ?? "the agency",
    tagline: cleanText(profile?.tagline, 160),
    brandTone: cleanText(profile?.brandTone, 400),
    defaultCallToAction: cleanText(profile?.defaultCallToAction, 200),
    marketingDisclaimer: cleanText(profile?.marketingDisclaimer, 1000),
    approvedContacts: {
      phone: profile?.useCompanyPhone ? cleanText(record.companyPhone, 32) : null,
      email: profile?.useCompanyEmail ? cleanText(record.companyEmail, 254) : null,
      website: cleanText(profile?.website, 300),
      whatsapp: cleanText(profile?.whatsappNumber, 32),
    },
  };
}

function amenities(rows: Array<{amenity?: {name: string} | null}> | undefined) {
  return (rows ?? []).slice(0, 30).map(row => cleanText(row.amenity?.name, 60)).filter((name): name is string => Boolean(name));
}

export function presentPropertyFacts(record: PropertyRecord) {
  return {
    reference: cleanText(record.propertyReference, 80),
    type: humanize(record.propertyType), market: humanize(record.marketType),
    bedrooms: record.bedrooms ?? null, bedroomsNote: record.bedrooms === 0 ? "studio" : null, bathrooms: record.bathrooms ?? null,
    builtUpArea: areaText(record.builtUpArea, record.areaUnit), plotArea: areaText(record.plotArea, record.areaUnit),
    floor: record.floorNumber ?? null, furnishing: humanize(record.furnishedStatus), occupancy: humanize(record.occupancyStatus),
    parkingSpaces: record.parkingSpaces ?? null, view: cleanText(record.view, 80),
    availability: humanize(record.inventoryStatus),
    location: presentLocation(record),
    building: cleanText(record.building?.name, 120),
    project: cleanText(record.project?.projectName, 120), developer: cleanText(record.project?.developer?.name, 120),
    referencePrice: money(record.referencePriceMinor == null ? null : String(record.referencePriceMinor), "AED", "property reference price; not an advertised asking price, confirm before publishing"),
    amenities: amenities(record.propertyAmenities_on_property),
    features: (record.propertyFeatures_on_property ?? []).slice(0, 25).map(item => ({
      name: cleanText(item.key, 60),
      value: item.valueType === "NUMBER" ? `${item.numberValue ?? ""}${item.unit ? ` ${cleanText(item.unit, 20)}` : ""}`.trim()
        : item.valueType === "BOOLEAN" ? (item.booleanValue ? "Yes" : "No") : cleanText(item.textValue, 120),
    })),
  };
}

export function presentListingFacts(record: ListingRecord) {
  const property = record.property;
  return {
    reference: cleanText(record.listingReference, 80),
    title: cleanText(record.title, 180),
    purpose: record.listingPurpose === "RENT" ? "For rent" : "For sale",
    market: humanize(record.marketType),
    status: humanize(record.listingStatus),
    askingPrice: listingPrice(record),
    advertisingPermitNumber: cleanText(record.advertisingPermitNumber, 120),
    permitExpiryDate: dateOnly(record.permitExpiryDate),
    staffDescription: cleanText(record.description, 1500),
    property: {
      reference: cleanText(property.propertyReference, 80), type: humanize(property.propertyType),
      bedrooms: property.bedrooms ?? null, bathrooms: property.bathrooms ?? null,
      builtUpArea: areaText(property.builtUpArea, property.areaUnit), plotArea: areaText(property.plotArea, property.areaUnit),
      availability: humanize(property.inventoryStatus),
      location: presentLocation({emirate: property.emirate, city: property.city, community: property.community, area: property.area, mapDisplayMode: property.mapDisplayMode}),
      building: cleanText(property.building?.name, 120), project: cleanText(property.project?.projectName, 120),
    },
  };
}

/** Available units grouped by type and bedrooms with reference price ranges. */
export function groupUnits(units: UnitRecord[]) {
  const groups = new Map<string, {type: string | null; bedrooms: number | null; availableUnits: number; min: number | null; max: number | null}>();
  for (const row of units) {
    const key = `${row.propertyType}:${row.bedrooms ?? "-"}`;
    const group = groups.get(key) ?? {type: humanize(row.propertyType), bedrooms: row.bedrooms ?? null, availableUnits: 0, min: null, max: null};
    group.availableUnits += 1;
    const price = minorToMajor(row.referencePriceMinor == null ? null : String(row.referencePriceMinor));
    if (price != null) {
      group.min = group.min == null ? price : Math.min(group.min, price);
      group.max = group.max == null ? price : Math.max(group.max, price);
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => (a.min ?? Infinity) - (b.min ?? Infinity)).map(group => ({
    type: group.type, bedrooms: group.bedrooms, availableUnits: group.availableUnits,
    referencePriceFrom: formatMoney(group.min, "AED"), referencePriceTo: formatMoney(group.max, "AED"),
  }));
}

export function presentProjectFacts(record: ProjectRecord, plans: PaymentPlanRecord[] | null, units: {rows: UnitRecord[]; complete: boolean} | null) {
  return {
    name: cleanText(record.projectName, 120), code: cleanText(record.projectCode, 40),
    developer: cleanText(record.developer?.name, 120),
    type: humanize(record.projectType), ownership: humanize(record.ownershipType),
    status: humanize(record.projectStatus), constructionStatus: humanize(record.constructionStatus),
    location: presentLocation(record),
    launchDate: dateOnly(record.launchDate), expectedHandoverDate: dateOnly(record.expectedHandoverDate), actualHandoverDate: dateOnly(record.actualHandoverDate),
    startingPrice: money(record.startingPriceMinor == null ? null : String(record.startingPriceMinor), record.currency, "project starting price (indicative, not a unit price)"),
    totalUnits: record.totalUnits ?? null,
    projectPermitNumber: cleanText(record.permitNumber, 120),
    staffDescription: cleanText(record.marketingDescription ?? record.description, 1500),
    amenities: amenities(record.projectAmenities_on_project),
    phases: (record.projectPhases_on_project ?? []).slice(0, 20).map(phase => ({
      name: cleanText(phase.name, 80), status: humanize(phase.status),
      expectedHandoverDate: dateOnly(phase.expectedHandoverDate), actualHandoverDate: dateOnly(phase.actualHandoverDate),
    })),
    paymentPlans: plans === null ? null : plans.filter(plan => plan.isActive).slice(0, 5).map(plan => ({
      name: cleanText(plan.name, 120), booking: percent(plan.bookingPercentageBps), onHandover: percent(plan.handoverPercentageBps),
      instalments: (plan.paymentPlanInstallments_on_paymentPlan ?? []).slice(0, 24).map(item => ({
        share: percent(item.percentageBps), due: humanize(item.dueTrigger),
        ...(item.constructionMilestonePercent != null ? {atConstructionPercent: item.constructionMilestonePercent} : {}),
        ...(item.postHandoverMonths != null ? {monthsAfterHandover: item.postHandoverMonths} : {}),
        note: cleanText(item.description, 120),
      })),
    })),
    availableUnitTypes: units === null ? null : {basis: "available units visible to this user, with reference prices", complete: units.complete, groups: groupUnits(units.rows)},
  };
}

export function presentDeveloperFacts(record: DeveloperRecord) {
  return {name: cleanText(record.name, 160), description: cleanText(record.description, 800), website: cleanText(record.website, 300)};
}

const HONORIFICS = /^(mr|mrs|ms|miss|dr|eng|sheikh|sheikha|prof|sir|madam|mx)\.?$/i;

/** First given name only; null when it cannot be identified safely. */
export function firstName(fullName: string | null | undefined): string | null {
  const words = (cleanText(fullName, 160) ?? "").split(" ").filter(Boolean);
  const name = words.find(word => !HONORIFICS.test(word));
  if (!name || !/^[\p{L}][\p{L}'-]{0,39}$/u.test(name)) return null;
  return name;
}

/**
 * Minimal lead context: optional first name, what the customer is looking
 * for, and viewing/shortlist references. Never contact details, budget,
 * notes, source or assignment.
 */
export function presentLeadFacts(record: LeadRecord, properties: LeadPropertyRecord | null, options: {useFirstName: boolean; now: number}) {
  const viewings = properties?.viewings ?? [];
  const upcoming = viewings.filter(item => item.status === "SCHEDULED" && Date.parse(item.scheduledAt) >= options.now)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
  const past = viewings.filter(item => item.status === "COMPLETED").sort((a, b) => Date.parse(b.scheduledAt) - Date.parse(a.scheduledAt));
  const viewing = (item: LeadPropertyRecord["viewings"][number]) => ({
    propertyReference: cleanText(item.property.propertyReference, 80), dubaiTime: dubaiTime(item.scheduledAt),
    status: humanize(item.status), customerConfirmation: humanize(item.customerConfirmation ?? null),
    community: cleanText(item.property.community, 120), emirate: emirateName(item.property.emirate),
  });
  return {
    firstName: options.useFirstName ? firstName(record.contact?.fullName ?? record.fullName) : null,
    firstNameNote: options.useFirstName ? "Use only this first name, or a neutral greeting if it is null." : "Do not use the customer's name; use a neutral greeting.",
    leadStatus: humanize(record.status),
    lookingTo: humanize(record.transactionType),
    propertyType: cleanText(record.propertyType, 60), bedrooms: cleanText(record.bedroomPreference, 40),
    preferredLocation: cleanText(record.preferredLocation, 120),
    nextViewing: upcoming[0] ? viewing(upcoming[0]) : null,
    lastCompletedViewing: past[0] ? viewing(past[0]) : null,
    shortlistedReferences: properties ? properties.shortlist.filter(item => item.status !== "REMOVED" && item.status !== "NOT_INTERESTED").slice(0, 5)
      .map(item => cleanText(item.property.propertyReference, 80)).filter(Boolean) : null,
  };
}

export function sourceRef(kind: SourceRef["kind"], id: string, reference: string | null | undefined, updatedAt: string | null | undefined): SourceRef {
  return {kind, id: canonicalUuid(id), reference: cleanText(reference, 120), updatedAt: updatedAt ?? null};
}

/** A property's own listings, for its asking price and status. */
export function presentRelatedListing(row: {listingReference?: string | null; title: string; listingPurpose: string; listingStatus: string; askingPriceMinor: string; currency: string; rentalPeriod?: string | null; advertisingPermitNumber?: string | null}) {
  return {
    reference: cleanText(row.listingReference, 80), title: cleanText(row.title, 180), purpose: row.listingPurpose === "RENT" ? "For rent" : "For sale",
    status: humanize(row.listingStatus), askingPrice: listingPrice(row), advertisingPermitNumber: cleanText(row.advertisingPermitNumber, 120),
  };
}
