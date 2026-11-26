import "server-only";

import { listInventory } from "@/modules/inventory/server/service";
import { listLeads } from "@/modules/leads/server/service";
import { searchContacts } from "@/modules/leads/server/crm-service";
import { validateInput } from "@/modules/organizations/server/validation";
import { SEARCH_GROUP_LIMIT, combineSearchGroups, humanizeStatus, searchQuerySchema, subtitle, type SearchItem } from "../search-model";

/*
 * Header search across leads, contacts, properties and listings. Every lookup
 * is an existing list operation that already checks the session, the active
 * company and the member's role and record scope (agents see only their
 * assigned leads and inventory; managers have no inventory access). Nothing
 * here widens that: a refused lookup simply yields no group.
 */

async function leads(search: string): Promise<SearchItem[]> {
  const data = await listLeads({search, limit: SEARCH_GROUP_LIMIT});
  return data.leads.map(row => ({id: row.id, title: row.fullName, subtitle: subtitle(humanizeStatus(row.status), row.email ?? row.phone), href: `/leads/${row.id}`}));
}

async function contacts(search: string): Promise<SearchItem[]> {
  const data = await searchContacts({search, limit: SEARCH_GROUP_LIMIT});
  return data.contacts.map(row => ({id: row.id, title: row.fullName, subtitle: subtitle(row.email, row.phone), href: `/contacts/${row.id}`}));
}

async function properties(search: string): Promise<SearchItem[]> {
  const data = await listInventory("properties", {search, limit: SEARCH_GROUP_LIMIT});
  if (!("properties" in data)) return [];
  return data.properties.map(row => ({id: row.id, title: row.propertyReference, subtitle: subtitle(row.project?.projectName, row.community, humanizeStatus(row.inventoryStatus)), href: `/properties/${row.id}`}));
}

async function listings(search: string): Promise<SearchItem[]> {
  const data = await listInventory("listings", {search, limit: SEARCH_GROUP_LIMIT});
  if (!("propertyListings" in data)) return [];
  return data.propertyListings.map(row => ({id: row.id, title: row.title, subtitle: subtitle(row.listingReference, humanizeStatus(row.listingStatus)), href: `/listings/${row.id}`}));
}

export async function searchWorkspace(input: unknown) {
  const {q} = validateInput(searchQuerySchema, input);
  const [leadResults, contactResults, propertyResults, listingResults] = await Promise.allSettled([leads(q), contacts(q), properties(q), listings(q)]);
  return combineSearchGroups(q, {leads: leadResults, contacts: contactResults, properties: propertyResults, listings: listingResults});
}
