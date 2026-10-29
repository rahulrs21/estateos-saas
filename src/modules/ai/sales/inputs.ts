import type { MatchingProperty } from "../../leads/property-matching";
import type { FollowUpInput } from "./follow-ups";
import { lastInteractionAt } from "./follow-ups";
import type { LeadReadiness, LeadTimeline, ScoringInput } from "./scoring";

/**
 * Turns authorized CRM rows into scoring and follow-up inputs, and presents
 * matches. Pure, so tests can check the mapping against synthetic records.
 * Only allowlisted fields are copied: customer identity, contact details,
 * nationality, language and notes never enter these inputs.
 */

export interface RawMatch {
  property: MatchingProperty;
  listing: {id: string; listingPurpose: string; title: string; askingPriceMinor: string; currency: string; rentalPeriod?: string | null};
  reasons: string[];
}

export interface RawLeadState {
  now: string;
  lead: {
    status: string; archivedAt?: string | null; transactionType?: string | null; preferredLocation?: string | null; propertyType?: string | null;
    bedroomPreference?: string | null; budgetMin?: number | null; budgetMax?: number | null; currency?: string | null; createdAt: string; followUpAt?: string | null;
  };
  details: {timeline?: string | null; readiness?: string | null} | null;
  followUps: Array<{title: string; dueAt: string; status: string}>;
  activities: Array<{kind: string; createdAt: string}>;
  /** Null when the member has no inventory scope (managers) or the lead is archived. */
  property: null | {
    matches: RawMatch[]; reviewed: number; candidateTotal: number;
    viewings: Array<{id: string; propertyId: string; scheduledAt: string; status: string; customerConfirmation: string; outcome?: string | null; followUp?: unknown; property: {propertyReference: string}}>;
    shortlist: Array<{propertyId: string; status: string; updatedAt: string; property: {propertyReference: string}}>;
  };
}

const TRANSACTIONS = new Set(["BUY", "RENT", "INVEST"]);

export function buildSalesInputs(raw: RawLeadState): {scoring: ScoringInput; followUp: Omit<FollowUpInput, "missing">} {
  const now = Date.parse(raw.now);
  const viewings = raw.property?.viewings ?? [];
  const shortlist = raw.property?.shortlist ?? [];
  const upcoming = viewings.filter(item => item.status === "SCHEDULED" && Date.parse(item.scheduledAt) > now);
  const completed = viewings.filter(item => item.status === "COMPLETED");
  const scoring: ScoringInput = {
    now: raw.now,
    lead: {
      status: raw.lead.status, archived: Boolean(raw.lead.archivedAt),
      transactionType: TRANSACTIONS.has(raw.lead.transactionType ?? "") ? raw.lead.transactionType as ScoringInput["lead"]["transactionType"] : "BUY",
      preferredLocation: raw.lead.preferredLocation ?? null, propertyType: raw.lead.propertyType ?? null, bedroomPreference: raw.lead.bedroomPreference ?? null,
      budgetMin: raw.lead.budgetMin ?? null, budgetMax: raw.lead.budgetMax ?? null,
    },
    qualification: {timeline: (raw.details?.timeline ?? null) as LeadTimeline | null, readiness: (raw.details?.readiness ?? null) as LeadReadiness | null},
    inventory: raw.property ? {available: true, matchCount: raw.property.matches.length, complete: raw.property.reviewed >= raw.property.candidateTotal} : {available: false, matchCount: 0, complete: false},
    lastInteractionAt: lastInteractionAt(raw.activities),
    viewings: {
      available: Boolean(raw.property),
      upcomingConfirmed: upcoming.filter(item => item.customerConfirmation === "CONFIRMED").length,
      upcomingPending: upcoming.filter(item => item.customerConfirmation === "PENDING").length,
      completedPositive: completed.filter(item => item.outcome === "POSITIVE").length,
      completedNeutral: completed.filter(item => item.outcome === "NEUTRAL").length,
      completedNegativeOrNoShow: completed.filter(item => item.outcome === "NEGATIVE" || item.outcome === "NO_SHOW").length,
    },
    shortlist: {
      available: Boolean(raw.property),
      interested: shortlist.filter(item => item.status === "INTERESTED").length,
      saved: shortlist.filter(item => item.status === "SAVED").length,
    },
  };
  const followUp: Omit<FollowUpInput, "missing"> = {
    now: raw.now,
    lead: {status: raw.lead.status, archived: Boolean(raw.lead.archivedAt), createdAt: raw.lead.createdAt, followUpAt: raw.lead.followUpAt ?? null},
    followUps: raw.followUps.map(item => ({title: item.title, dueAt: item.dueAt, status: item.status})),
    activities: raw.activities.map(item => ({kind: item.kind, createdAt: item.createdAt})),
    viewings: raw.property ? viewings.map(item => ({
      id: item.id, propertyId: item.propertyId, propertyReference: item.property.propertyReference, scheduledAt: item.scheduledAt, status: item.status,
      customerConfirmation: item.customerConfirmation, outcome: item.outcome ?? null, hasFollowUp: Boolean(item.followUp),
    })) : null,
    shortlist: raw.property ? shortlist.map(item => ({propertyId: item.propertyId, propertyReference: item.property.propertyReference, status: item.status, updatedAt: item.updatedAt})) : null,
  };
  return {scoring, followUp};
}

/** Requirements the engine could not filter on because they are not recorded for this lead. */
export function matchCriteriaGaps(lead: RawLeadState["lead"] & {projectId?: string | null}) {
  const gaps: string[] = [];
  if (!lead.preferredLocation?.trim()) gaps.push("No preferred location recorded, so location was not filtered.");
  if (!lead.propertyType?.trim()) gaps.push("No property type recorded, so all types were considered.");
  if (!lead.bedroomPreference?.trim()) gaps.push("No bedroom requirement recorded.");
  if (lead.budgetMin == null && lead.budgetMax == null) gaps.push("No budget recorded, so price was not filtered.");
  gaps.push("Property size, features and amenities are not part of recorded lead requirements, so they were not matched.");
  return gaps;
}

const formatMoney = (minor: string, currency: string) => {
  if (!/^\d+$/.test(minor)) return null;
  const major = BigInt(minor) / BigInt(100);
  return `${currency} ${major.toLocaleString("en-US")}`;
};

/** A verified match as shown to the member and given to Claude. Location is text only (never address or coordinates). */
export function presentMatch(match: RawMatch) {
  const {property, listing} = match;
  const priceText = formatMoney(listing.askingPriceMinor, listing.currency);
  return {
    propertyId: property.id,
    reference: property.propertyReference,
    link: `/properties/${property.id}`,
    project: property.project?.projectName ?? null,
    propertyType: property.propertyType,
    bedrooms: property.bedrooms ?? null,
    bathrooms: property.bathrooms ?? null,
    size: property.builtUpArea ? `${property.builtUpArea.toLocaleString("en-US")} ${(property.areaUnit ?? "SQFT").toLowerCase()}` : null,
    location: {emirate: property.emirate ?? null, community: property.community ?? null, area: property.area ?? null},
    availability: "Available, with an active listing",
    listing: {
      id: listing.id, title: listing.title, purpose: listing.listingPurpose,
      price: priceText ? `${priceText}${listing.listingPurpose === "RENT" ? ` per ${listing.rentalPeriod === "MONTHLY" ? "month" : "year"}` : ""}` : null,
    },
    matchReasons: match.reasons,
  };
}
export type PresentedMatch = ReturnType<typeof presentMatch>;
