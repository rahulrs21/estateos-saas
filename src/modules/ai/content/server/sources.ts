import "server-only";

import { getInventoryRecord, listInventory } from "@/modules/inventory/server/service";
import { getLead } from "@/modules/leads/server/service";
import { getLeadPropertyData } from "@/modules/leads/server/property-service";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { collect, type Page } from "../../tools/records";
import type { SourceSelection } from "../catalog";
import {
  presentDeveloperFacts, presentLeadFacts, presentListingFacts, presentProjectFacts, presentPropertyFacts, presentRelatedListing, sourceRef,
  type DeveloperRecord, type FactSheet, type LeadPropertyRecord, type LeadRecord, type ListingRecord, type PaymentPlanRecord, type ProjectRecord,
  type PropertyRecord, type SourceRef, type UnitRecord,
} from "../facts";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/**
 * Reads every selected source record through the same services the CRM
 * screens use, so organization scope, role rules (agents: assigned leads and
 * inventory only; managers: no inventory), record-level access and map
 * privacy apply exactly as elsewhere. An ID from the browser is only a
 * reference: if the service does not return the record, generation stops.
 * "Not found" and "not permitted" give the same answer.
 */

const unavailable = () => new WorkspaceError("SOURCE_UNAVAILABLE", 404, "One of the selected records is unavailable or outside the records you can use. Choose it again from the list.");

/** Permission, validation and not-found failures all become the same answer; database failures stay retryable. */
async function required<T>(load: () => Promise<T | null | undefined>): Promise<T> {
  let record: T | null | undefined;
  try { record = await load(); } catch (error) {
    if (error instanceof WorkspaceError && error.status !== 503 && error.status !== 504 && error.code !== "RATE_LIMITED") throw unavailable();
    throw error;
  }
  if (record == null) throw unavailable();
  return record;
}

async function page<T>(resource: "listings" | "properties" | "payment-plans", input: Record<string, unknown>, key: string): Promise<Page<T>> {
  const data = await listInventory(resource, input) as unknown as Record<string, unknown> & {total: number};
  return {rows: (data[key] as T[] | undefined) ?? [], total: data.total};
}

async function loadProperty(id: string, facts: FactSheet, sources: SourceRef[]) {
  const record = await required(() => getInventoryRecord("properties", {id}) as Promise<PropertyRecord | null>);
  const listings = await page<Parameters<typeof presentRelatedListing>[0]>("listings", {propertyId: canonicalUuid(record.id), limit: 5, offset: 0}, "propertyListings").catch(() => null);
  facts.properties.push({
    ...presentPropertyFacts(record),
    listings: listings ? listings.rows.map(presentRelatedListing) : "Listings for this property are not available to this user.",
  });
  sources.push(sourceRef("property", record.id, record.propertyReference, record.updatedAt));
}

async function loadListing(id: string, facts: FactSheet, sources: SourceRef[], withPropertyDetail: boolean) {
  const record = await required(() => getInventoryRecord("listings", {id}) as Promise<ListingRecord | null>);
  facts.listings.push(presentListingFacts(record));
  sources.push(sourceRef("listing", record.id, record.listingReference, record.updatedAt));
  if (!withPropertyDetail) return;
  // Amenities, features and view live on the property. Agents may hold a listing
  // without the property being assigned to them; then only the listing facts are used.
  try {
    const property = await getInventoryRecord("properties", {id: canonicalUuid(record.property.id)}) as PropertyRecord | null;
    if (property) {
      facts.properties.push(presentPropertyFacts(property));
      sources.push(sourceRef("property", property.id, property.propertyReference, property.updatedAt));
    }
  } catch {
    facts.unavailable.push("Full property details (amenities, features, view) are not available to this user; use the listing facts only.");
  }
}

async function loadProject(id: string, facts: FactSheet, sources: SourceRef[]) {
  const record = await required(() => getInventoryRecord("projects", {id}) as Promise<(ProjectRecord & {developerId?: string | null}) | null>);
  const projectId = canonicalUuid(record.id);
  const [plans, units, developer] = await Promise.allSettled([
    page<PaymentPlanRecord>("payment-plans", {projectId, limit: 10, offset: 0}, "paymentPlans"),
    collect<UnitRecord>((limit, offset) => page("properties", {projectId, inventoryStatus: "AVAILABLE", limit, offset}, "properties"), () => true, 300),
    record.developer?.id ? getInventoryRecord("developers", {id: canonicalUuid(record.developer.id)}) as Promise<DeveloperRecord | null> : Promise.resolve(null),
  ]);
  if (plans.status === "rejected") facts.unavailable.push("Payment plans are not available to this user.");
  if (units.status === "rejected") facts.unavailable.push("Unit inventory for this project is not available to this user.");
  facts.project = presentProjectFacts(record, plans.status === "fulfilled" ? plans.value.rows : null,
    units.status === "fulfilled" ? {rows: units.value.rows, complete: units.value.complete} : null);
  sources.push(sourceRef("project", record.id, record.projectName, record.updatedAt));
  if (developer.status === "fulfilled" && developer.value) {
    facts.developer = presentDeveloperFacts(developer.value);
    sources.push(sourceRef("developer", developer.value.id, developer.value.name, developer.value.updatedAt));
  }
}

async function loadLead(id: string, facts: FactSheet, sources: SourceRef[], useFirstName: boolean) {
  const {lead} = await required(async () => {
    const data = await getLead({leadId: id}) as unknown as {lead: LeadRecord | null};
    return data.lead ? data : null;
  });
  let properties: LeadPropertyRecord | null = null;
  try {
    properties = await getLeadPropertyData({leadId: canonicalUuid(lead!.id), page: 1}) as unknown as LeadPropertyRecord;
  } catch {
    facts.unavailable.push("Viewings and shortlisted properties for this lead are not available to this user.");
  }
  facts.lead = presentLeadFacts(lead!, properties, {useFirstName, now: Date.now()});
  // The lead's name is personal data: the source reference stores no label.
  sources.push(sourceRef("lead", lead!.id, null, lead!.updatedAt));
}

export async function loadFacts(context: Context, selection: SourceSelection, options: {useLeadFirstName: boolean; withPropertyDetail: boolean}) {
  const facts: FactSheet = {
    readAt: new Date().toISOString(),
    sender: {name: context.profile.displayName?.trim() || null, note: "The signed-in team member preparing this draft."},
    properties: [], listings: [], project: null, developer: null, lead: null, unavailable: [],
  };
  const sources: SourceRef[] = [];
  // Sequential on purpose: a denied record stops generation before more data is read.
  if (selection.propertyId) await loadProperty(selection.propertyId, facts, sources);
  if (selection.listingId) await loadListing(selection.listingId, facts, sources, options.withPropertyDetail);
  for (const listingId of selection.listingIds ?? []) await loadListing(listingId, facts, sources, false);
  if (selection.projectId) await loadProject(selection.projectId, facts, sources);
  if (selection.leadId) await loadLead(selection.leadId, facts, sources, options.useLeadFirstName);
  return {facts, sources};
}
