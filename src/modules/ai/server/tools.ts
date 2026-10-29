import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { getInventoryRecord, listInventory } from "@/modules/inventory/server/service";
import { getLead, leadListOperation, leadQueryVariables, listLeads } from "@/modules/leads/server/service";
import { getLeadPropertyData } from "@/modules/leads/server/property-service";
import type { AiToolInputs } from "../tools/definitions";
import type { ToolHandlers, ToolResultData } from "../tools/registry";
import {
  areaText, budgetOverlaps, cleanText, dubaiDayRange, emirateName, formatMoney, humanize, locationMatches,
  majorToMinor, memberName, minorToMajor, money, presentLocation, recordLinks, textMatches,
} from "../tools/present";
import { liveQualification } from "../sales/server/service";
import {
  annualRent, collect, coverage, listingPrice, presentLeadSummary, presentListingSummary, presentProjectSummary, presentPropertySummary,
  type LeadRow, type ListingRow, type Page, type ProjectRow, type PropertyRow,
} from "../tools/records";

/**
 * Read-only Copilot tools. Every handler calls the same services the CRM
 * screens use, so organization scope, role rules (agents see only assigned
 * leads and inventory, managers have no inventory scope) and map privacy are
 * enforced exactly as they are elsewhere, from the verified session. Nothing
 * here writes business data.
 */



async function inventoryPage<T>(resource: "properties" | "listings" | "projects" | "payment-plans", input: Record<string, unknown>, key: string): Promise<Page<T>> {
  const data = await listInventory(resource, input) as unknown as Record<string, unknown> & {total: number};
  return {rows: (data[key] as T[] | undefined) ?? [], total: data.total};
}

function filterInput(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

// --- Properties --------------------------------------------------------------


async function searchProperties(input: AiToolInputs["searchProperties"]): Promise<ToolResultData> {
  const location = input.community ? [input.community] : [];
  const bedroomsOk = (bedrooms: number | null | undefined) => (input.bedrooms === undefined || bedrooms === input.bedrooms)
    && (input.minBedrooms === undefined || (bedrooms != null && bedrooms >= input.minBedrooms));
  const locationOk = (fields: Array<string | null | undefined>) => location.every(term => locationMatches(term, fields));

  if (input.purpose) {
    // Active listings carry the asking price; rents are compared annually.
    const rent = input.purpose === "RENT";
    const keepListing = (row: ListingRow) => {
      if (!bedroomsOk(row.property.bedrooms)) return false;
      if (input.projectId && (!row.property.project || canonicalUuid(row.property.project.id) !== canonicalUuid(input.projectId))) return false;
      if (input.projectName && !textMatches(input.projectName, [row.property.project?.projectName])) return false;
      if (!locationOk([emirateName(row.property.emirate), row.property.city, row.property.community, row.property.project?.projectName, row.title])) return false;
      if (rent) {
        const annual = annualRent(row);
        if (annual == null) return false;
        if (input.minPrice !== undefined && annual < input.minPrice) return false;
        if (input.maxPrice !== undefined && annual > input.maxPrice) return false;
      }
      return true;
    };
    const base = filterInput({
      purpose: input.purpose, listingStatus: "ACTIVE", emirate: input.emirate, propertyType: input.propertyType, marketType: input.marketType,
      minimumPriceMinor: rent ? undefined : majorToMinor(input.minPrice), maximumPriceMinor: rent ? undefined : majorToMinor(input.maxPrice),
      sort: "PRICE_ASC",
    });
    const needsLocal = Boolean(location.length || input.bedrooms !== undefined || input.minBedrooms !== undefined || input.projectId || input.projectName || rent);
    const result = await collect<ListingRow>((limit, offset) => inventoryPage("listings", {...base, limit, offset}, "propertyListings"), needsLocal ? keepListing : null, input.limit);
    return {resultCount: result.rows.length, data: {
      searched: "active listings", priceBasis: rent ? "asking rent, compared as annual rent" : "asking sale price",
      results: result.rows.map(presentListingSummary), coverage: coverage(result),
    }};
  }

  const status = input.availability === "ANY" ? undefined : input.availability;
  const base = filterInput({
    emirate: input.emirate, propertyType: input.propertyType, marketType: input.marketType, inventoryStatus: status,
    bedrooms: input.bedrooms, projectId: input.projectId,
    minimumPriceMinor: majorToMinor(input.minPrice), maximumPriceMinor: majorToMinor(input.maxPrice),
  });
  const keepProperty = (row: PropertyRow) => bedroomsOk(row.bedrooms)
    && (!input.projectName || textMatches(input.projectName, [row.project?.projectName]))
    && locationOk([emirateName(row.emirate), row.city, row.community, row.area, row.project?.projectName]);
  const fetch = (extra: Record<string, unknown>) => (limit: number, offset: number) => inventoryPage<PropertyRow>("properties", {...base, ...extra, limit, offset}, "properties");
  const needsLocal = Boolean(location.length || input.minBedrooms !== undefined || input.projectName);

  // An exact (case-insensitive) community match runs in the database first; a
  // broader word match over a bounded scan is the fallback.
  let result = input.community
    ? await collect<PropertyRow>(fetch({community: input.community}), input.minBedrooms !== undefined || input.projectName ? keepProperty : null, input.limit)
    : null;
  if (!result || result.rows.length === 0) result = await collect<PropertyRow>(fetch({}), needsLocal ? keepProperty : null, input.limit);
  return {resultCount: result.rows.length, data: {
    searched: status ? `${status.toLowerCase()} property units` : "property units (any status)",
    priceBasis: "property reference price; use purpose SALE or RENT for active listing asking prices",
    results: result.rows.map(presentPropertySummary), coverage: coverage(result),
  }};
}


async function resolvePropertyId(input: AiToolInputs["getPropertyDetails"]) {
  if (input.propertyId) return input.propertyId;
  const page = await inventoryPage<PropertyRow>("properties", {search: input.propertyReference, limit: 2, offset: 0}, "properties");
  if (page.rows.length !== 1) throw new WorkspaceError("NOT_FOUND", 404, "Property not found.");
  return page.rows[0].id;
}

async function getPropertyDetails(input: AiToolInputs["getPropertyDetails"]): Promise<ToolResultData> {
  const id = canonicalUuid(await resolvePropertyId(input));
  const record = await getInventoryRecord("properties", {id}) as unknown as (PropertyRow & {
    unitNumber?: string | null; floorNumber?: number | null; parkingSpaces?: number | null; view?: string | null;
    propertyAmenities_on_property?: Array<{amenity?: {name: string} | null}>;
    propertyFeatures_on_property?: Array<{key: string; valueType: string; textValue?: string | null; numberValue?: number | null; booleanValue?: boolean | null; unit?: string | null}>;
  }) | null;
  if (!record) throw new WorkspaceError("NOT_FOUND", 404, "Property not found.");
  const listings = await inventoryPage<ListingRow>("listings", {propertyId: id, limit: 10, offset: 0}, "propertyListings").catch(() => null);
  return {resultCount: 1, data: {
    ...presentPropertySummary(record),
    building: cleanText(record.building?.name, 120), unitNumber: cleanText(record.unitNumber, 40), floor: record.floorNumber ?? null,
    plotSize: areaText(record.plotArea, record.areaUnit), furnished: humanize(record.furnishedStatus), occupancy: humanize(record.occupancyStatus),
    parkingSpaces: record.parkingSpaces ?? null, view: cleanText(record.view, 80),
    assignedAgent: memberName(record.assignedMembership),
    amenities: (record.propertyAmenities_on_property ?? []).slice(0, 25).map(item => cleanText(item.amenity?.name, 60)).filter(Boolean),
    features: (record.propertyFeatures_on_property ?? []).slice(0, 25).map(item => ({
      name: cleanText(item.key, 60),
      value: item.valueType === "NUMBER" ? `${item.numberValue ?? ""}${item.unit ? ` ${cleanText(item.unit, 20)}` : ""}`.trim()
        : item.valueType === "BOOLEAN" ? (item.booleanValue ? "Yes" : "No") : cleanText(item.textValue, 120),
    })),
    listings: listings
      ? listings.rows.map(row => ({id: canonicalUuid(row.id), reference: cleanText(row.listingReference, 80), link: recordLinks.listing(canonicalUuid(row.id)),
        title: cleanText(row.title, 140), purpose: row.listingPurpose, status: humanize(row.listingStatus), price: listingPrice(row)}))
      : "Listings could not be loaded for this property.",
  }};
}

// --- Projects ----------------------------------------------------------------


async function searchProjects(input: AiToolInputs["searchProjects"]): Promise<ToolResultData> {
  const keep = (row: ProjectRow) => {
    if (input.name && !textMatches(input.name, [row.projectName, row.projectCode])) return false;
    if (input.developerName && !textMatches(input.developerName, [row.developer?.name])) return false;
    if (input.community && !locationMatches(input.community, [row.community, row.area, row.city, emirateName(row.emirate)])) return false;
    const handover = row.expectedHandoverDate?.slice(0, 10);
    if (input.handoverFrom && (!handover || handover < input.handoverFrom)) return false;
    if (input.handoverTo && (!handover || handover > input.handoverTo)) return false;
    const starting = minorToMajor(row.startingPriceMinor);
    if (input.minStartingPrice !== undefined && (starting == null || starting < input.minStartingPrice)) return false;
    if (input.maxStartingPrice !== undefined && (starting == null || starting > input.maxStartingPrice)) return false;
    return true;
  };
  const needsLocal = Boolean(input.name || input.developerName || input.community || input.handoverFrom || input.handoverTo
    || input.minStartingPrice !== undefined || input.maxStartingPrice !== undefined);
  const base = filterInput({emirate: input.emirate, projectStatus: input.projectStatus});
  const result = await collect<ProjectRow>((limit, offset) => inventoryPage("projects", {...base, limit, offset}, "projects"), needsLocal ? keep : null, input.limit);
  return {resultCount: result.rows.length, data: {results: result.rows.map(presentProjectSummary), coverage: coverage(result)}};
}

async function resolveProject(input: AiToolInputs["getProjectDetails"]) {
  if (input.projectId) return {id: input.projectId, candidates: null};
  const exact = await inventoryPage<ProjectRow>("projects", {search: input.projectName, limit: 5, offset: 0}, "projects");
  const rows = exact.rows.length ? exact.rows
    : (await collect<ProjectRow>((limit, offset) => inventoryPage("projects", {limit, offset}, "projects"), row => textMatches(input.projectName!, [row.projectName]), 6)).rows;
  if (!rows.length) throw new WorkspaceError("NOT_FOUND", 404, "Project not found.");
  if (rows.length > 1) return {id: null, candidates: rows.map(presentProjectSummary)};
  return {id: rows[0].id, candidates: null};
}

async function getProjectDetails(input: AiToolInputs["getProjectDetails"]): Promise<ToolResultData> {
  const resolved = await resolveProject(input);
  if (!resolved.id) {
    return {resultCount: resolved.candidates?.length ?? 0, data: {ambiguous: true, message: "Several projects match. Ask the user which one they mean.", candidates: resolved.candidates}};
  }
  const id = canonicalUuid(resolved.id);
  const project = await getInventoryRecord("projects", {id}) as unknown as (ProjectRow & {
    projectPhases_on_project?: Array<{name: string; status?: string | null; expectedHandoverDate?: string | null; actualHandoverDate?: string | null}>;
    projectAmenities_on_project?: Array<{amenity?: {name: string} | null}>;
    permitNumber?: string | null;
  }) | null;
  if (!project) throw new WorkspaceError("NOT_FOUND", 404, "Project not found.");
  const [plans, units] = await Promise.allSettled([
    inventoryPage<{name: string; isActive: boolean; bookingPercentageBps?: number | null; handoverPercentageBps?: number | null; property?: {propertyReference: string} | null;
      paymentPlanInstallments_on_paymentPlan?: Array<{position: number; percentageBps: number; dueTrigger: string; constructionMilestonePercent?: number | null; postHandoverMonths?: number | null; description?: string | null}>}>(
      "payment-plans", {projectId: id, limit: 10, offset: 0}, "paymentPlans"),
    collect<PropertyRow>((limit, offset) => inventoryPage("properties", {projectId: id, inventoryStatus: "AVAILABLE", limit, offset}, "properties"), () => true, 300),
  ]);
  const percent = (bps: number | null | undefined) => bps == null ? null : `${(bps / 100).toLocaleString("en-US", {maximumFractionDigits: 2})}%`;
  const unitGroups = new Map<string, {type: string | null; bedrooms: number | null; count: number; minPrice: number | null; maxPrice: number | null}>();
  if (units.status === "fulfilled") {
    for (const row of units.value.rows) {
      const key = `${row.propertyType}:${row.bedrooms ?? "-"}`;
      const group = unitGroups.get(key) ?? {type: humanize(row.propertyType), bedrooms: row.bedrooms ?? null, count: 0, minPrice: null, maxPrice: null};
      group.count += 1;
      const price = minorToMajor(row.referencePriceMinor);
      if (price != null) {
        group.minPrice = group.minPrice == null ? price : Math.min(group.minPrice, price);
        group.maxPrice = group.maxPrice == null ? price : Math.max(group.maxPrice, price);
      }
      unitGroups.set(key, group);
    }
  }
  return {resultCount: 1, data: {
    ...presentProjectSummary(project),
    code: cleanText(project.projectCode, 40), ownership: humanize(project.ownershipType), launchDate: project.launchDate ?? null,
    description: cleanText(project.description ?? project.marketingDescription, 800),
    phases: (project.projectPhases_on_project ?? []).slice(0, 20).map(phase => ({name: cleanText(phase.name, 80), status: humanize(phase.status),
      expectedHandover: phase.expectedHandoverDate ?? null, actualHandover: phase.actualHandoverDate ?? null})),
    amenities: (project.projectAmenities_on_project ?? []).slice(0, 25).map(item => cleanText(item.amenity?.name, 60)).filter(Boolean),
    paymentPlans: plans.status === "fulfilled"
      ? plans.value.rows.map(plan => ({name: cleanText(plan.name, 120), active: plan.isActive, unit: cleanText(plan.property?.propertyReference, 80),
        booking: percent(plan.bookingPercentageBps), onHandover: percent(plan.handoverPercentageBps),
        instalments: (plan.paymentPlanInstallments_on_paymentPlan ?? []).slice(0, 24).map(item => ({
          share: percent(item.percentageBps), due: humanize(item.dueTrigger),
          ...(item.constructionMilestonePercent != null ? {atConstructionPercent: item.constructionMilestonePercent} : {}),
          ...(item.postHandoverMonths != null ? {monthsAfterHandover: item.postHandoverMonths} : {}),
          note: cleanText(item.description, 120),
        }))}))
      : "Payment plans are not available to this user.",
    availableUnitTypes: units.status === "fulfilled"
      ? {basis: "available units this user can see, with property reference prices", complete: units.value.complete,
        groups: [...unitGroups.values()].sort((a, b) => (a.minPrice ?? Infinity) - (b.minPrice ?? Infinity)).map(group => ({
          type: group.type, bedrooms: group.bedrooms, availableUnits: group.count,
          priceFrom: formatMoney(group.minPrice, "AED"), priceTo: formatMoney(group.maxPrice, "AED")}))}
      : "Unit inventory is not available to this user.",
  }};
}

// --- Leads -------------------------------------------------------------------


async function resolveAgent(name: string) {
  const {request, organizationId} = await requireActiveOrganizationRequest();
  const data = await executeWorkspaceOperation(() => sql.listLeadAssignees(request.dc, {organizationId, limit: 100, offset: 0}, request.options), "ListLeadAssignees");
  const matches = data.memberships.filter(member => textMatches(name, [member.userProfile?.displayName, member.email]));
  return matches.map(member => ({id: canonicalUuid(member.id), name: memberName(member)}));
}

async function searchLeads(input: AiToolInputs["searchLeads"]): Promise<ToolResultData> {
  const nowMs = Date.now();
  const context = await requireActiveOrganizationRequest();
  let assignedMembershipId: string | undefined;
  if (input.assignment === "MINE") assignedMembershipId = context.membership.id;
  if (input.assignedAgentName) {
    const agents = await resolveAgent(input.assignedAgentName);
    if (!agents.length) return {resultCount: 0, data: {results: [], message: "No agent the user can see matches that name."}};
    if (agents.length > 1) return {resultCount: 0, data: {results: [], ambiguousAgent: true, candidates: agents.map(agent => agent.name), message: "Several agents match. Ask which one."}};
    assignedMembershipId = agents[0].id;
  }
  const keep = (row: LeadRow) => (input.assignment !== "UNASSIGNED" || !row.assignedMembershipId)
    && (!input.source || textMatches(input.source, [row.source, row.leadSource?.name]))
    && (!input.preferredLocation || locationMatches(input.preferredLocation, [row.preferredLocation]))
    && (input.minBudget === undefined && input.maxBudget === undefined || budgetOverlaps(row, input.minBudget, input.maxBudget));
  const needsLocal = Boolean(input.assignment === "UNASSIGNED" || input.source || input.preferredLocation || input.minBudget !== undefined || input.maxBudget !== undefined);
  const sort = input.followUp === "ANY" ? "UPDATED_DESC" : "FOLLOW_UP_ASC";
  const listInput = filterInput({
    search: input.search, status: input.status, priority: input.priority, transactionType: input.transactionType, assignedMembershipId, sort,
    followUp: input.followUp === "OVERDUE" ? "OVERDUE" : input.followUp === "UPCOMING" ? "UPCOMING" : "ALL",
  });

  const fetchPage = async (limit: number, offset: number): Promise<Page<LeadRow>> => {
    if (input.followUp !== "TODAY") {
      const data = await listLeads({...listInput, limit, offset});
      return {rows: data.leads as LeadRow[], total: data.total};
    }
    // Today's follow-ups (Dubai calendar day), using the same stored query and authorization as the leads list.
    const {request, organizationId} = context;
    const {start, end} = dubaiDayRange(nowMs);
    const variables = {...leadQueryVariables(organizationId, {...listInput, limit, offset}), followUpAfter: start, followUpBefore: end};
    const operation = leadListOperation("FOLLOW_UP_ASC");
    const data = await executeWorkspaceOperation(() => operation(request.dc, variables, request.options), "ListLeads:FOLLOW_UP_ASC");
    return {rows: data.leads, total: data.total[0]?.count ?? 0};
  };
  const result = await collect<LeadRow>(fetchPage, needsLocal ? keep : null, input.limit);
  return {resultCount: result.rows.length, data: {
    scope: context.membership.role === "OWNER" || context.membership.role === "ADMIN" ? "company leads" : "leads assigned to this user",
    results: result.rows.map(row => presentLeadSummary(row, nowMs)), coverage: coverage(result),
  }};
}

async function getLeadDetails(input: AiToolInputs["getLeadDetails"]): Promise<ToolResultData> {
  const nowMs = Date.now();
  const context = await requireActiveOrganizationRequest();
  const {lead} = await getLead({leadId: input.leadId});
  if (!lead) throw new WorkspaceError("NOT_FOUND", 404, "Lead not found.");
  const leadId = canonicalUuid(lead.id);
  const {request, organizationId} = context;
  const [properties, followUps, activities] = await Promise.allSettled([
    getLeadPropertyData({leadId, page: 1}),
    executeWorkspaceOperation(() => sql.listLeadFollowUps(request.dc, {organizationId, leadId, limit: 10, offset: 0}, request.options), "ListLeadFollowUps"),
    executeWorkspaceOperation(() => sql.listLeadActivities(request.dc, {organizationId, leadId, limit: 15, offset: 0}, request.options), "ListLeadActivities"),
  ]);
  const summary = presentLeadSummary(lead as unknown as LeadRow, nowMs);
  return {resultCount: 1, data: {
    ...summary,
    archived: Boolean(lead.archivedAt),
    propertyInterest: cleanText(lead.propertyInterest, 300),
    shortlist: properties.status === "fulfilled" ? properties.value.shortlist.slice(0, 15).map(item => ({
      propertyId: item.propertyId, reference: cleanText(item.property.propertyReference, 80), link: recordLinks.property(item.propertyId),
      status: humanize(item.status), project: cleanText(item.property.project?.projectName, 120),
    })) : "Shortlist is not available to this user.",
    primaryInterest: properties.status === "fulfilled" ? {
      project: properties.value.primaryProject ? {name: cleanText(properties.value.primaryProject.projectName, 120), link: recordLinks.project(properties.value.primaryProject.id)} : null,
      property: properties.value.primaryProperty ? {reference: cleanText(properties.value.primaryProperty.propertyReference, 80), link: recordLinks.property(properties.value.primaryProperty.id)} : null,
    } : null,
    viewings: properties.status === "fulfilled" ? properties.value.viewings.slice(0, 10).map(viewing => ({
      propertyReference: cleanText(viewing.property.propertyReference, 80), propertyLink: recordLinks.property(viewing.propertyId),
      scheduledAt: viewing.scheduledAt, status: humanize(viewing.status), customerConfirmation: humanize(viewing.customerConfirmation),
      outcome: humanize(viewing.outcome ?? null),
    })) : "Viewings are not available to this user.",
    followUps: followUps.status === "fulfilled" ? followUps.value.followUps.map(item => ({
      title: cleanText(item.title, 160), dueAt: item.dueAt, status: humanize(item.status),
      overdue: item.status === "PENDING" && Date.parse(item.dueAt) < nowMs, assignedTo: memberName(item.assignedUser),
    })) : "Follow-ups could not be loaded.",
    recentActivity: activities.status === "fulfilled" ? activities.value.activities.map(item => ({
      type: humanize(item.kind), at: item.createdAt, by: cleanText(item.actor?.displayName, 80),
    })) : "Activity could not be loaded.",
    note: "Contact details and note text are intentionally excluded; open the lead in EstateOS for them.",
  }};
}

async function getMatchingPropertiesForLead(input: AiToolInputs["getMatchingPropertiesForLead"]): Promise<ToolResultData> {
  const data = await getLeadPropertyData({leadId: input.leadId, page: 1});
  const matches = data.matches.slice(0, input.limit).map(({property, listing, reasons}) => ({
    property: {id: property.id, reference: cleanText(property.propertyReference, 80), link: recordLinks.property(property.id), type: humanize(property.propertyType),
      bedrooms: property.bedrooms ?? null, location: presentLocation({emirate: property.emirate, community: property.community, area: property.area}),
      project: cleanText(property.project?.projectName, 120)},
    listing: {id: canonicalUuid(listing.id), link: recordLinks.listing(canonicalUuid(listing.id)), title: cleanText(listing.title, 140), purpose: listing.listingPurpose,
      price: money(listing.askingPriceMinor, listing.currency, listing.listingPurpose === "RENT" ? `asking rent${listing.rentalPeriod ? ` (${listing.rentalPeriod.toLowerCase()})` : ""}` : "asking sale price")},
    reasons: reasons.map(reason => cleanText(reason, 160)),
  }));
  return {resultCount: matches.length, data: {
    engine: "EstateOS lead-to-property matching (available units with an active listing that meets the lead's requirements)",
    matches, totalMatchesOnThisPage: data.matches.length,
    coverage: {candidatesReviewed: data.reviewed, candidatesInScope: data.candidateTotal, complete: data.reviewed >= data.candidateTotal},
  }};
}

// --- Dashboard ---------------------------------------------------------------

async function getDashboardSummary(): Promise<ToolResultData> {
  const {request, organizationId, membership} = await requireActiveOrganizationRequest();
  const [metrics, overdue, upcoming, inventory] = await Promise.allSettled([
    executeWorkspaceOperation(() => sql.getLeadMetrics(request.dc, {organizationId}, request.options), "GetLeadMetrics"),
    listLeads({followUp: "OVERDUE", limit: 1}),
    listLeads({followUp: "UPCOMING", limit: 1}),
    membership.role === "MANAGER"
      ? Promise.reject(new WorkspaceError("FORBIDDEN", 403, "No inventory scope."))
      : executeWorkspaceOperation(() => sql.getInventoryDashboardMetrics(request.dc, {organizationId}, request.options), "GetInventoryDashboardMetrics"),
  ]);
  const count = (rows: Array<{count: number}> | undefined) => rows?.[0]?.count ?? 0;
  const leadScope = membership.role === "OWNER" || membership.role === "ADMIN" ? "company-wide" : "leads assigned to this user";
  return {resultCount: 1, data: {
    asOf: new Date().toISOString(),
    leads: metrics.status === "fulfilled" ? {scope: leadScope, total: count(metrics.value.total), new: count(metrics.value.newLeads),
      qualified: count(metrics.value.qualified), wonOrConverted: count(metrics.value.won)} : "Lead figures could not be loaded.",
    followUps: overdue.status === "fulfilled" && upcoming.status === "fulfilled"
      ? {scope: leadScope, leadsWithOverdueFollowUp: overdue.value.total, leadsWithUpcomingFollowUp: upcoming.value.total} : "Follow-up figures could not be loaded.",
    inventory: inventory.status === "fulfilled" ? {
      scope: membership.role === "AGENT" ? "inventory assigned to this user" : "company inventory",
      totalProperties: count(inventory.value.totalProperties), availableProperties: count(inventory.value.availableProperties),
      reservedProperties: count(inventory.value.reservedProperties), activeListings: count(inventory.value.activeListings),
    } : "Inventory figures are not available to this user's role.",
  }};
}

/** Live rule-based qualification (Phase 6C). Nothing is stored; the lead page's Evaluate score stores assessments. */
async function getLeadQualification(input: AiToolInputs["getLeadQualification"]): Promise<ToolResultData> {
  const context = await requireActiveOrganizationRequest();
  return {resultCount: 1, data: await liveQualification(context, input.leadId)};
}

export const copilotToolHandlers: ToolHandlers = {
  searchProperties,
  getPropertyDetails,
  searchProjects,
  getProjectDetails,
  searchLeads,
  getLeadDetails,
  getDashboardSummary,
  getMatchingPropertiesForLead,
  getLeadQualification,
};
