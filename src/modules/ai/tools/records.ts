import { canonicalUuid } from "../../organizations/server/identifiers";
import { areaText, cleanText, formatMoney, humanize, memberName, minorToMajor, money, presentLocation, recordLinks } from "./present";

/**
 * Pure record presenters and the bounded scan used by the server tools.
 * Presenters are allowlists: contact details, notes, internal references,
 * coordinates and place IDs are never copied into tool results.
 */

export const SCAN_PAGE_SIZE = 100;
export const MAX_SCAN_PAGES = 3;

export interface Page<T> { rows: T[]; total: number }

/** Fetch filtered rows; when local filters apply, scan up to three pages and report coverage. */
export async function collect<T>(fetchPage: (limit: number, offset: number) => Promise<Page<T>>, keep: ((row: T) => boolean) | null, want: number) {
  if (!keep) {
    const page = await fetchPage(want, 0);
    return {rows: page.rows, totalMatching: page.total, scanned: page.rows.length, totalInScope: page.total, complete: true};
  }
  const rows: T[] = [];
  let scanned = 0;
  let total = 0;
  for (let index = 0; index < MAX_SCAN_PAGES; index += 1) {
    const page = await fetchPage(SCAN_PAGE_SIZE, index * SCAN_PAGE_SIZE);
    total = page.total;
    scanned += page.rows.length;
    for (const row of page.rows) if (keep(row)) rows.push(row);
    if (rows.length >= want || scanned >= total || page.rows.length < SCAN_PAGE_SIZE) break;
  }
  return {rows: rows.slice(0, want), totalMatching: null as number | null, scanned, totalInScope: total, complete: scanned >= total, moreMatchesAvailable: rows.length > want};
}

export interface PropertyRow {
  id: string; propertyReference: string; propertyType: string; marketType?: string | null; bedrooms?: number | null; bathrooms?: number | null;
  builtUpArea?: number | null; plotArea?: number | null; areaUnit?: string | null; emirate?: string | null; city?: string | null;
  community?: string | null; area?: string | null; address?: string | null; mapDisplayMode?: string | null; referencePriceMinor?: string | null;
  inventoryStatus: string; occupancyStatus?: string | null; furnishedStatus?: string | null; projectId?: string | null;
  project?: {id?: string; projectName: string; developer?: {id: string; name: string} | null} | null;
  building?: {name: string} | null; assignedMembership?: {userProfile?: {displayName?: string | null} | null} | null; updatedAt?: string;
}

export interface ListingRow {
  id: string; listingReference?: string | null; listingPurpose: string; marketType?: string | null; title: string; askingPriceMinor: string;
  currency: string; rentalPeriod?: string | null; listingStatus: string; updatedAt?: string;
  property: {id: string; propertyReference: string; propertyType: string; bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null;
    areaUnit?: string | null; emirate?: string | null; city?: string | null; community?: string | null; project?: {id: string; projectName: string} | null};
}

export function listingPrice(row: {askingPriceMinor: string; currency: string; listingPurpose: string; rentalPeriod?: string | null}) {
  const price = money(row.askingPriceMinor, row.currency, row.listingPurpose === "RENT" ? `asking rent${row.rentalPeriod ? ` (${row.rentalPeriod.toLowerCase()})` : ""}` : "asking sale price");
  return price;
}

export function annualRent(row: ListingRow) {
  const amount = minorToMajor(row.askingPriceMinor);
  if (amount == null) return null;
  return row.listingPurpose === "RENT" && row.rentalPeriod === "MONTHLY" ? amount * 12 : amount;
}

export function presentPropertySummary(row: PropertyRow) {
  const id = canonicalUuid(row.id);
  return {
    id, reference: cleanText(row.propertyReference, 80), link: recordLinks.property(id),
    type: humanize(row.propertyType), market: humanize(row.marketType), bedrooms: row.bedrooms ?? null, bathrooms: row.bathrooms ?? null,
    size: areaText(row.builtUpArea ?? row.plotArea, row.areaUnit),
    location: presentLocation(row),
    project: row.project ? {name: cleanText(row.project.projectName, 120), developer: cleanText(row.project.developer?.name, 120)} : null,
    availability: humanize(row.inventoryStatus),
    referencePrice: money(row.referencePriceMinor, "AED", "property reference price (not an active listing price)"),
  };
}

export function presentListingSummary(row: ListingRow) {
  const id = canonicalUuid(row.id);
  const propertyId = canonicalUuid(row.property.id);
  return {
    listingId: id, listingReference: cleanText(row.listingReference, 80), listingLink: recordLinks.listing(id), title: cleanText(row.title, 140),
    purpose: row.listingPurpose, status: humanize(row.listingStatus), market: humanize(row.marketType), price: listingPrice(row),
    property: {id: propertyId, reference: cleanText(row.property.propertyReference, 80), link: recordLinks.property(propertyId), type: humanize(row.property.propertyType),
      bedrooms: row.property.bedrooms ?? null, bathrooms: row.property.bathrooms ?? null, size: areaText(row.property.builtUpArea, row.property.areaUnit),
      location: presentLocation({emirate: row.property.emirate, city: row.property.city, community: row.property.community}),
      project: cleanText(row.property.project?.projectName, 120)},
  };
}

export function coverage(result: {rows: unknown[]; totalMatching: number | null; scanned: number; totalInScope: number; complete: boolean; moreMatchesAvailable?: boolean}) {
  return result.totalMatching !== null
    ? {returned: result.rows.length, totalMatching: result.totalMatching, complete: true}
    : {returned: result.rows.length, recordsScanned: result.scanned, recordsInScope: result.totalInScope, complete: result.complete,
      ...(result.moreMatchesAvailable ? {moreMatchesAvailable: true} : {})};
}

export interface ProjectRow {
  id: string; projectName: string; projectCode?: string | null; description?: string | null; marketingDescription?: string | null;
  projectType?: string | null; ownershipType?: string | null; community?: string | null; area?: string | null; emirate?: string | null; city?: string | null;
  address?: string | null; mapDisplayMode?: string | null; launchDate?: string | null; expectedHandoverDate?: string | null; actualHandoverDate?: string | null;
  constructionStatus?: string | null; projectStatus: string; startingPriceMinor?: string | null; currency?: string | null; totalUnits?: number | null;
  developer?: {id?: string; name: string} | null; properties_on_project?: {_count: number};
}

export function presentProjectSummary(row: ProjectRow) {
  const id = canonicalUuid(row.id);
  return {
    id, name: cleanText(row.projectName, 120), link: recordLinks.project(id), developer: cleanText(row.developer?.name, 120),
    location: presentLocation(row), status: humanize(row.projectStatus), construction: humanize(row.constructionStatus), type: humanize(row.projectType),
    expectedHandover: row.expectedHandoverDate ?? null, actualHandover: row.actualHandoverDate ?? null,
    startingPrice: money(row.startingPriceMinor, row.currency, "project starting price (indicative, not a unit price)"),
    totalUnits: row.totalUnits ?? null,
    ...(row.properties_on_project ? {availableUnits: row.properties_on_project._count} : {}),
  };
}

export interface LeadRow {
  id: string; fullName: string; status: string; priority: string; transactionType: string; currency: string;
  propertyType?: string | null; bedroomPreference?: string | null; preferredLocation?: string | null;
  budgetMin?: number | null; budgetMax?: number | null; source?: string | null; followUpAt?: string | null;
  assignedMembershipId?: string | null; createdAt: string; updatedAt: string;
  contact?: {fullName: string} | null; pipelineStage?: {name: string} | null; leadSource?: {name: string} | null;
  assignedMembership?: {userProfile?: {displayName?: string | null} | null} | null;
}

export function presentLeadSummary(row: LeadRow, nowMs: number) {
  const id = canonicalUuid(row.id);
  const followUp = row.followUpAt ?? null;
  return {
    id, link: recordLinks.lead(id), name: cleanText(row.contact?.fullName ?? row.fullName, 120),
    status: humanize(row.status), stage: cleanText(row.pipelineStage?.name, 60), priority: humanize(row.priority),
    wants: humanize(row.transactionType), propertyType: cleanText(row.propertyType, 60), bedrooms: cleanText(row.bedroomPreference, 40),
    preferredLocation: cleanText(row.preferredLocation, 120),
    budget: row.budgetMin != null || row.budgetMax != null
      ? {from: formatMoney(row.budgetMin ?? null, row.currency), to: formatMoney(row.budgetMax ?? null, row.currency)} : null,
    source: cleanText(row.leadSource?.name ?? row.source, 80),
    nextFollowUpAt: followUp, followUpOverdue: followUp ? Date.parse(followUp) < nowMs : false,
    assignedAgent: row.assignedMembership ? memberName(row.assignedMembership) : "Unassigned",
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}
