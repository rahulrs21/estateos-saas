import type { LeadFilters, LeadRecord } from "./types";

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
