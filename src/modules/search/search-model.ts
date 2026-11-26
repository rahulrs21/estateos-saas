import { z } from "zod";

/*
 * Global search rules, shared by the server and the header search dialog.
 * The server fans a query out to the existing, permission-checked list
 * operations; these helpers only validate the query and shape the results.
 */

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_LENGTH = 80;
/** Results per group. */
export const SEARCH_GROUP_LIMIT = 5;

export const searchQuerySchema = z.strictObject({
  q: z.string().trim().min(SEARCH_MIN_LENGTH, `Type at least ${SEARCH_MIN_LENGTH} characters.`).max(SEARCH_MAX_LENGTH, `Use at most ${SEARCH_MAX_LENGTH} characters.`),
});

export type SearchGroupKey = "leads" | "contacts" | "properties" | "listings";
export type SearchItem = {id: string; title: string; subtitle: string; href: string};
export type SearchGroup = {key: SearchGroupKey; label: string; items: SearchItem[]};
export type SearchResult = {query: string; groups: SearchGroup[]; unavailable: SearchGroupKey[]};

export const SEARCH_GROUP_LABELS: Record<SearchGroupKey, string> = {leads: "Leads", contacts: "Contacts", properties: "Properties", listings: "Listings"};
const ORDER: SearchGroupKey[] = ["leads", "contacts", "properties", "listings"];

/**
 * Combines settled group lookups in a fixed order: empty groups are left out,
 * and a group whose lookup was refused or failed is listed as unavailable
 * (for example inventory for a role without inventory access) rather than
 * failing the whole search.
 */
export function combineSearchGroups(query: string, settled: Partial<Record<SearchGroupKey, PromiseSettledResult<SearchItem[]>>>): SearchResult {
  const groups: SearchGroup[] = [];
  const unavailable: SearchGroupKey[] = [];
  for (const key of ORDER) {
    const result = settled[key];
    if (!result) continue;
    if (result.status === "rejected") { unavailable.push(key); continue; }
    const items = result.value.slice(0, SEARCH_GROUP_LIMIT);
    if (items.length) groups.push({key, label: SEARCH_GROUP_LABELS[key], items});
  }
  return {query, groups, unavailable};
}

/** "Negotiation" from "NEGOTIATION", "Viewing scheduled" from "VIEWING_SCHEDULED". */
export function humanizeStatus(value: string | null | undefined) {
  if (!value) return "";
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Joins the non-empty parts of a subtitle with " · ". */
export function subtitle(...parts: Array<string | null | undefined>) {
  return parts.map(part => part?.trim()).filter(Boolean).join(" · ");
}
