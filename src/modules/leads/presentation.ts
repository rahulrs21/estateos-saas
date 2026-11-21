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
  for (const [key, value] of Object.entries({ ...filters, ...changes })) {
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

const AVATAR_TONES = [
  "bg-blue-500/10 text-blue-700 dark:text-blue-300", "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300", "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
];
/** A stable colour per name, so the same lead always looks the same. */
export function avatarTone(name: string) {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}
