import type { LeadEnquiry, LeadFilters, LeadRecord } from "./types";

/**
 * Where a lead's oldest activity is in its newest-first timeline: on the loaded page
 * (when the page reaches the end), at an offset to read, or nowhere (no activity, or
 * past the reading limit).
 */
export function oldestActivityPlace(input: {total: number; page: number; pageSize: number; loaded: number; maxOffset?: number}): "LOADED" | {offset: number} | null {
  if (input.total <= 0) return null;
  if ((input.page - 1) * input.pageSize + input.loaded >= input.total) return input.loaded > 0 ? "LOADED" : null;
  const offset = input.total - 1;
  return offset <= (input.maxOffset ?? 10_000) ? {offset} : null;
}

/** The visitor's enquiry, when the lead's first activity is a website form or landing page capture. */
export function leadEnquiryFrom(activity: {kind: string; note?: string | null; createdAt: string} | null | undefined): LeadEnquiry | null {
  if (activity?.kind !== "WEBSITE_LEAD_CAPTURED") return null;
  return {message: activity.note?.trim() || null, receivedAt: activity.createdAt};
}

/** Keep applied filters while encoding every value as URL data. */
export function leadsHref(filters: LeadFilters, changes: Partial<LeadFilters> = {}) {
  const query = new URLSearchParams();
  const next = { ...filters, ...changes };
  for (const [key, value] of Object.entries(next)) {
    // A preset range is recomputed by the server, so its dates are not part of the link.
    if ((key === "createdFrom" || key === "createdTo") && next.range && next.range !== "CUSTOM") continue;
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  return `/leads?${query.toString()}`;
}

export const leadPriorityLabels = { LOW: "Low", NORMAL: "Normal", HIGH: "High", URGENT: "Urgent" } as const;
export const leadSortLabels = {
  CREATED_DESC: "Newest first", CREATED_ASC: "Oldest first", UPDATED_DESC: "Recently updated",
  NAME_ASC: "Name: A to Z", NAME_DESC: "Name: Z to A", FOLLOW_UP_ASC: "Next follow-up",
} as const;

export function leadBudget(lead: Pick<LeadRecord, "budgetMin" | "budgetMax" | "currency">) {
  const amount = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(value);
  const currency = lead.currency || "AED";
  if (lead.budgetMin != null && lead.budgetMax != null) return `${currency} ${amount(lead.budgetMin)} – ${amount(lead.budgetMax)}`;
  if (lead.budgetMin != null) return `From ${currency} ${amount(lead.budgetMin)}`;
  if (lead.budgetMax != null) return `Up to ${currency} ${amount(lead.budgetMax)}`;
  return "Not specified";
}

export function leadInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
}

const TRANSACTION_LABELS = {BUY: "Buy", RENT: "Rent", INVEST: "Invest"} as const;

/**
 * The details a website form sends into a lead, in the form's order, leaving out the
 * empty ones. They are read from the lead as saved now (EstateOS keeps no separate
 * copy of the submitted values), so an edit by the team shows here too.
 */
export function enquiryFields(lead: Pick<LeadRecord, "fullName" | "email" | "phone" | "propertyInterest" | "preferredLocation" | "propertyType" | "transactionType" | "budgetMin" | "budgetMax" | "currency" | "bedroomPreference">) {
  const budget = lead.budgetMin != null || lead.budgetMax != null ? leadBudget(lead) : null;
  const fields: Array<[string, string | null | undefined]> = [
    ["Full name", lead.fullName], ["Email address", lead.email], ["Phone number", lead.phone],
    ["Property interest", lead.propertyInterest], ["Preferred location", lead.preferredLocation], ["Property type", lead.propertyType],
    ["Buy, rent or invest", lead.transactionType ? TRANSACTION_LABELS[lead.transactionType] : null], ["Budget", budget], ["Bedrooms", lead.bedroomPreference],
  ];
  return fields.flatMap(([label, value]) => typeof value === "string" && value.trim() ? [{label, value: value.trim()}] : []);
}

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC+4, no daylight saving.
const dubaiDay = (instant: number) => new Date(instant + DUBAI_OFFSET_MS).toISOString().slice(0, 10);
const addDays = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The created-date window (Dubai calendar days, both included) for a range preset.
 * CUSTOM keeps the chosen dates; ALL has none. `now` is injectable for tests.
 */
export function resolveLeadDateRange(range: LeadFilters["range"], custom: {createdFrom: string; createdTo: string}, now = Date.now()): {createdFrom: string; createdTo: string} {
  const today = dubaiDay(now);
  switch (range) {
    case "TODAY": return {createdFrom: today, createdTo: today};
    case "YESTERDAY": { const day = addDays(today, -1); return {createdFrom: day, createdTo: day}; }
    case "7D": return {createdFrom: addDays(today, -6), createdTo: today};
    case "30D": return {createdFrom: addDays(today, -29), createdTo: today};
    case "LAST_MONTH": {
      const firstOfThisMonth = `${today.slice(0, 7)}-01`;
      const lastOfPrevious = addDays(firstOfThisMonth, -1);
      return {createdFrom: `${lastOfPrevious.slice(0, 7)}-01`, createdTo: lastOfPrevious};
    }
    case "ALL": return {createdFrom: "", createdTo: ""};
    default: return {createdFrom: custom.createdFrom, createdTo: custom.createdTo};
  }
}

export const leadDateRangeLabels: Record<LeadFilters["range"], string> = {
  TODAY: "Today", YESTERDAY: "Yesterday", "7D": "Last 7 days", "30D": "Last 30 days",
  LAST_MONTH: "Last month", ALL: "All time", CUSTOM: "Custom range",
};
