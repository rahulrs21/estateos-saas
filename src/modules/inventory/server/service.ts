import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { assertExpectedOrganization } from "@/modules/leads/server/request-policy";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { omitNullishQueryVariables } from "./query-variables";
import { presentMapLocation, redactStoredLocation, snapBoundsToGrid } from "@/modules/maps/geo";
import { mapPinPageSchema, mapViewportSchema } from "@/modules/maps/validation";
import { mapPinRateLimitChecks } from "@/modules/maps/rate-limits";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import {
  allowedListingTransitions, listingStatusInputSchema, listingTransitions,
  amenityInputSchema, buildingInputSchema, developerInputSchema, featureInputSchema, featureUpdateSchema,
  floorPlanInputSchema, inventoryPageSchema, inventoryResourceSchema, listingInputSchema, normalizeInventorySearch,
  parseInventory, paymentInstallmentInputSchema, paymentPlanActivationSchema, paymentPlanCreateSchema,
  paymentPlanInputSchema, phaseInputSchema, projectInputSchema, propertyInputSchema, inventoryMediaUploadSchema,
  type InventoryResource,
} from "../validation";
import { uuidSchema } from "@/modules/organizations/server/validation";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;
type EnumMap = Record<string, string>;

function enumValue<T extends EnumMap>(values: T, value: string): T[keyof T] {
  if (!Object.hasOwn(values, value)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a valid inventory option.");
  return values[value as keyof T];
}

function without(input: Record<string, unknown>, ...keys: string[]) {
  return Object.fromEntries(Object.entries(input).filter(([key]) => !keys.includes(key)));
}

function normalizeListInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, "Provide valid inventory filters.");
  }
  const raw = {...input as Record<string, unknown>};
  for (const key of ["limit", "offset"]) {
    if (typeof raw[key] === "string") {
      if (!/^\d+$/.test(raw[key] as string)) throw new WorkspaceError("VALIDATION_ERROR", 400, "Use whole-number pagination values.");
      raw[key] = Number(raw[key]);
    }
  }
  for (const [key, item] of Object.entries(raw)) if (item === "") delete raw[key];
  const result = inventoryPageSchema.safeParse(raw);
  if (!result.success) throw new WorkspaceError("VALIDATION_ERROR", 400, "Check inventory filters and pagination.");
  return {...result.data, search: normalizeInventorySearch(result.data.search), community: normalizeInventorySearch(result.data.community)};
}

function totalCount(rows: Array<{_count: number}> | undefined) {
  return rows?.[0]?._count ?? 0;
}

function paged<T extends {total: Array<{_count: number}>}>(data: T, limit: number, offset: number) {
  const total = totalCount(data.total);
  return {...data, total, limit, offset, hasNext: offset + limit < total};
}

async function readContext(): Promise<Context> {
  const context = await requireActiveOrganizationRequest();
  if (context.membership.role === "MANAGER") {
    throw new WorkspaceError("FORBIDDEN", 403, "Inventory access requires a verified branch or team scope, which is not configured for this workspace.");
  }
  return context;
}

async function writeContext(expectedOrganizationId: string | null, allowAssignedListingAgent = false) {
  const context = await readContext();
  assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  if (allowAssignedListingAgent && context.membership.role === "AGENT") return context;
  assertOrganizationAdministrator(context.membership);
  return context;
}

const listingSortFlags = (sort: string | undefined) => ({
  sortUpdated: !sort || sort === "UPDATED_DESC", sortPriceAsc: sort === "PRICE_ASC",
  sortPriceDesc: sort === "PRICE_DESC", sortCreated: sort === "CREATED_DESC",
});

/**
 * Property media is served to agents only for properties assigned to them
 * (see getInventoryMediaRecord). A listing can be assigned to an agent whose
 * property is not, so its media is omitted rather than shown as broken files.
 */
function withAuthorizedMedia<T extends {assignedMembershipId?: string | null; inventoryMedias_on_property?: unknown[]}>(property: T, membership: Context["membership"]): T {
  if (membership.role !== "AGENT" || (property.assignedMembershipId && canonicalUuid(property.assignedMembershipId) === canonicalUuid(membership.id))) return property;
  return {...property, inventoryMedias_on_property: []};
}

/** Administrators edit locations and see them as stored; other readers get them as the map display mode allows. */
const revealsExactLocation = (membership: Context["membership"]) => membership.role === "OWNER" || membership.role === "ADMIN";

function safeResource(resource: string): InventoryResource {
  return parseInventory(inventoryResourceSchema, resource);
}

const inventoryTransitions: Record<string, readonly string[]> = {
  DRAFT: ["AVAILABLE", "INACTIVE"],
  AVAILABLE: ["RESERVED", "SOLD", "RENTED", "INACTIVE"],
  RESERVED: ["AVAILABLE", "SOLD", "RENTED", "INACTIVE"],
  SOLD: ["INACTIVE"], RENTED: ["AVAILABLE", "INACTIVE"], INACTIVE: ["AVAILABLE"],
};

async function authorizeListingUpdate(context: Context, id: string, requestedStatus: string, requestedMembershipId: string | null) {
  const {request, organizationId, membership} = context;
  const current = membership.role === "AGENT"
    ? (await executeWorkspaceOperation(() => sql.getAssignedPropertyListing(request.dc, {organizationId, id, assignedMembershipId: membership.id}, request.options), "GetAssignedPropertyListing")).propertyListing
    : (await executeWorkspaceOperation(() => sql.getPropertyListing(request.dc, {organizationId, id}, request.options), "GetPropertyListing")).propertyListing;
  if (!current) throw new WorkspaceError("NOT_FOUND", 404, "This listing is unavailable.");
  if (membership.role === "AGENT") {
    if (requestedMembershipId !== membership.id) throw new WorkspaceError("FORBIDDEN", 403, "Agents can manage only listings assigned to themselves.");
    if (!["DRAFT", "PENDING_REVIEW"].includes(requestedStatus)) throw new WorkspaceError("FORBIDDEN", 403, "Agents may prepare a listing for review, but only an administrator can approve or publish it.");
  }
  if (current.listingStatus !== requestedStatus && !listingTransitions[current.listingStatus]?.includes(requestedStatus)) {
    throw new WorkspaceError("VALIDATION_ERROR", 400, `A listing cannot move from ${current.listingStatus.replaceAll("_", " ")} to ${requestedStatus.replaceAll("_", " ")}.`);
  }
  return current;
}

export async function listInventory(resourceName: string, input: unknown = {}) {
  const resource = safeResource(resourceName);
  const context = await readContext();
  const filters = normalizeListInput(input);
  const {request, organizationId, membership} = context;
  const common = omitNullishQueryVariables({organizationId, limit: filters.limit, offset: filters.offset, search: filters.search});

  switch (resource) {
    case "developers": {
      const data = await executeWorkspaceOperation(() => sql.listDevelopers(request.dc, common, request.options), "ListDevelopers");
      return paged(data, filters.limit, filters.offset);
    }
    case "projects": {
      const data = await executeWorkspaceOperation(() => sql.listProjects(request.dc, omitNullishQueryVariables({
        ...common, developerId: filters.developerId,
        projectStatus: filters.projectStatus ? enumValue(sql.ProjectStatus, filters.projectStatus) : undefined,
        emirate: filters.emirate ? enumValue(sql.Emirate, filters.emirate) : undefined,
      }), request.options), "ListProjects");
      if (revealsExactLocation(membership)) return paged(data, filters.limit, filters.offset);
      return paged({...data, projects: data.projects.map(project => redactStoredLocation(project, project.mapDisplayMode))}, filters.limit, filters.offset);
    }
    case "phases": {
      if (!filters.projectId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a project to list its phases.");
      const data = await executeWorkspaceOperation(() => sql.listProjectPhases(request.dc, {
        ...common, projectId: filters.projectId!,
      }, request.options), "ListProjectPhases");
      return paged(data, filters.limit, filters.offset);
    }
    case "buildings": {
      const data = await executeWorkspaceOperation(() => sql.listBuildings(request.dc, omitNullishQueryVariables({
        ...common, projectId: filters.projectId, phaseId: filters.phaseId,
        status: filters.status ? enumValue(sql.CompletionStatus, filters.status) : undefined,
      }), request.options), "ListBuildings");
      if (revealsExactLocation(membership)) return paged(data, filters.limit, filters.offset);
      return paged({...data, buildings: data.buildings.map(building => redactStoredLocation(building, building.project.mapDisplayMode))}, filters.limit, filters.offset);
    }
    case "properties": {
      const assignedMembershipId = membership.role === "AGENT" ? membership.id : filters.assignedMembershipId ?? null;
      const data = await executeWorkspaceOperation(() => sql.listPropertiesAdvanced(request.dc, omitNullishQueryVariables({
        ...common, projectId: filters.projectId, developerId: filters.developerId, buildingId: filters.buildingId,
        propertyType: filters.propertyType ? enumValue(sql.PropertyType, filters.propertyType) : undefined,
        inventoryStatus: filters.inventoryStatus ? enumValue(sql.InventoryStatus, filters.inventoryStatus) : undefined,
        marketType: filters.marketType ? enumValue(sql.MarketType, filters.marketType) : undefined,
        emirate: filters.emirate ? enumValue(sql.Emirate, filters.emirate) : undefined,
        community: filters.community, bedrooms: filters.bedrooms,
        minimumPriceMinor: filters.minimumPriceMinor, maximumPriceMinor: filters.maximumPriceMinor,
        assignedMembershipId,
      }), request.options), "ListPropertiesAdvanced");
      return paged(data, filters.limit, filters.offset);
    }
    case "listings": {
      const listingFilters = omitNullishQueryVariables({
        ...common,
        propertyId: filters.propertyId,
        listingStatus: filters.listingStatus ? enumValue(sql.ListingStatus, filters.listingStatus) : undefined,
        purpose: filters.purpose ? enumValue(sql.ListingPurpose, filters.purpose) : undefined,
        marketType: filters.marketType ? enumValue(sql.MarketType, filters.marketType) : undefined,
        emirate: filters.emirate ? enumValue(sql.Emirate, filters.emirate) : undefined,
        propertyType: filters.propertyType ? enumValue(sql.PropertyType, filters.propertyType) : undefined,
        community: filters.community, minimumPriceMinor: filters.minimumPriceMinor, maximumPriceMinor: filters.maximumPriceMinor,
        ...listingSortFlags(filters.sort),
      });
      const data = membership.role === "AGENT"
        ? await executeWorkspaceOperation(() => sql.listAssignedPropertyListings(request.dc, {
            ...listingFilters, assignedMembershipId: membership.id,
          }, request.options), "ListAssignedPropertyListings")
        : await executeWorkspaceOperation(() => sql.listPropertyListings(request.dc, listingFilters, request.options), "ListPropertyListings");
      const {byPriceAsc, byPriceDesc, byCreated, propertyListings, ...rest} = data;
      const rows = (propertyListings ?? byPriceAsc ?? byPriceDesc ?? byCreated ?? []).map(listing => ({
        ...listing, property: withAuthorizedMedia(listing.property, membership),
      }));
      return paged({...rest, propertyListings: rows}, filters.limit, filters.offset);
    }
    case "floor-plans": {
      if (!filters.projectId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a project to list its floor plans.");
      const data = await executeWorkspaceOperation(() => sql.listFloorPlans(request.dc, omitNullishQueryVariables({
        ...common, projectId: filters.projectId!, buildingId: filters.buildingId,
      }), request.options), "ListFloorPlans");
      return paged(data, filters.limit, filters.offset);
    }
    case "payment-plans": {
      if (!filters.projectId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a project to list its payment plans.");
      const data = await executeWorkspaceOperation(() => sql.listPaymentPlans(request.dc, omitNullishQueryVariables({
        ...common, projectId: filters.projectId!,
      }), request.options), "ListPaymentPlans");
      return paged(data, filters.limit, filters.offset);
    }
    case "amenities": {
      const data = await executeWorkspaceOperation(() => sql.listInventoryAmenities(request.dc, common, request.options), "ListInventoryAmenities");
      return paged(data, filters.limit, filters.offset);
    }
    case "features": {
      if (!filters.propertyId) throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a property to list its features.");
      const data = await executeWorkspaceOperation(() => sql.listPropertyFeatures(request.dc, omitNullishQueryVariables({
        ...common, propertyId: filters.propertyId!,
      }), request.options), "ListPropertyFeatures");
      return paged(data, filters.limit, filters.offset);
    }
  }
}

/**
 * Pins returned per map request. Configurable with MAPS_PIN_QUERY_LIMIT
 * (50–1000, default 500); the stored operations reject anything above 1000.
 */
export function mapPinQueryLimit(value = process.env.MAPS_PIN_QUERY_LIMIT) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 50 && parsed <= 1000 ? parsed : 500;
}

const mapPinControlKeys = ["south", "north", "west", "east", "offset", "limit", "view", "page", "pageSize"] as const;

/** Split viewport and paging controls from list filters, validating each part. */
function parseMapPinRequest(raw: Record<string, unknown>) {
  const filters: Record<string, unknown> = {...raw};
  for (const key of mapPinControlKeys) delete filters[key];
  const edges = ["south", "north", "west", "east"].filter(key => raw[key] !== undefined && raw[key] !== "");
  if (edges.length !== 0 && edges.length !== 4) throw new WorkspaceError("VALIDATION_ERROR", 400, "Send all four map bounds or none.");
  const bounds = edges.length === 4
    ? snapBoundsToGrid(parseInventory(mapViewportSchema, {south: raw.south, north: raw.north, west: raw.west, east: raw.east}))
    : null;
  const offset = raw.offset === undefined || raw.offset === "" ? 0 : parseInventory(mapPinPageSchema, raw.offset);
  return {filters, bounds, offset};
}

/**
 * Map pins for the property or listing map view, filtered on the server by the
 * page's filters and, when given, the visible map bounds; paged by offset.
 * The stored operations already exclude HIDDEN locations; every remaining
 * point is passed through presentMapLocation here, so APPROXIMATE coordinates
 * are coarsened before they can leave the server. Raw coordinates are never
 * part of the result. `mapped` counts matches in the area, `mappedAll` matches
 * anywhere, and `total` every match including unmapped and hidden records.
 */
export async function listInventoryMapPins(resourceName: "properties" | "listings", input: unknown = {}, clientIp: string | null = null) {
  const context = await readContext();
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const {filters: rawFilters, bounds, offset} = parseMapPinRequest(raw);
  const filters = normalizeListInput({...rawFilters, limit: 1, offset: 0});
  const {request, organizationId, membership} = context;
  await enforceRateLimit(mapPinRateLimitChecks({membershipId: membership.id, clientIp}), "The map is refreshing too often. Wait a moment and try again.");
  const limit = mapPinQueryLimit();
  const shared = {
    organizationId, limit, offset, ...(bounds ?? {}), search: filters.search, community: filters.community,
    propertyType: filters.propertyType ? enumValue(sql.PropertyType, filters.propertyType) : undefined,
    marketType: filters.marketType ? enumValue(sql.MarketType, filters.marketType) : undefined,
    emirate: filters.emirate ? enumValue(sql.Emirate, filters.emirate) : undefined,
    minimumPriceMinor: filters.minimumPriceMinor, maximumPriceMinor: filters.maximumPriceMinor,
  };
  const display = (location: {latitude?: number | null; longitude?: number | null; mapDisplayMode: string}) =>
    presentMapLocation(location, {revealExact: false}).display;
  const page = <T,>(data: {total: Array<{_count: number}>; mapped: Array<{_count: number}>; mappedAll: Array<{_count: number}>}, pins: T[]) => {
    const mapped = totalCount(data.mapped);
    return {total: totalCount(data.total), mapped, mappedAll: totalCount(data.mappedAll), limit, offset, bounds,
      hasMore: offset + pins.length < mapped, pins};
  };

  if (resourceName === "properties") {
    const data = await executeWorkspaceOperation(() => sql.listPropertyMapPins(request.dc, omitNullishQueryVariables({
      ...shared, projectId: filters.projectId, developerId: filters.developerId, buildingId: filters.buildingId, bedrooms: filters.bedrooms,
      inventoryStatus: filters.inventoryStatus ? enumValue(sql.InventoryStatus, filters.inventoryStatus) : undefined,
      assignedMembershipId: membership.role === "AGENT" ? membership.id : filters.assignedMembershipId ?? null,
    }), request.options), "ListPropertyMapPins");
    return page(data, data.properties.map(({latitude, longitude, mapDisplayMode, inventoryMedias_on_property, ...property}) => ({
      ...property, coverMediaId: inventoryMedias_on_property[0]?.id ?? null, location: display({latitude, longitude, mapDisplayMode}),
    })));
  }

  const listingFilters = omitNullishQueryVariables({
    ...shared,
    listingStatus: filters.listingStatus ? enumValue(sql.ListingStatus, filters.listingStatus) : undefined,
    purpose: filters.purpose ? enumValue(sql.ListingPurpose, filters.purpose) : undefined,
  });
  const data = membership.role === "AGENT"
    ? await executeWorkspaceOperation(() => sql.listAssignedPropertyListingMapPins(request.dc, {...listingFilters, assignedMembershipId: membership.id}, request.options), "ListAssignedPropertyListingMapPins")
    : await executeWorkspaceOperation(() => sql.listPropertyListingMapPins(request.dc, listingFilters, request.options), "ListPropertyListingMapPins");
  return page(data, data.propertyListings.map(({property: {latitude, longitude, mapDisplayMode, ...property}, ...listing}) => ({
    ...listing, property, location: display({latitude, longitude, mapDisplayMode}),
  })));
}

/** Counts per listing status for the list summary, in the same scope as the list. */
export async function listingStatusCounts() {
  const {request, organizationId, membership} = await readContext();
  const data = membership.role === "AGENT"
    ? await executeWorkspaceOperation(() => sql.assignedListingStatusCounts(request.dc, {organizationId, assignedMembershipId: membership.id}, request.options), "AssignedListingStatusCounts")
    : await executeWorkspaceOperation(() => sql.listingStatusCounts(request.dc, {organizationId}, request.options), "ListingStatusCounts");
  const counts: Record<string, number> = {};
  for (const row of data.statuses) counts[row.listingStatus] = (counts[row.listingStatus] ?? 0) + row._count;
  return counts;
}

/** Status history for one listing (creation, updates and workflow steps). */
export async function listListingActivity(idInput: unknown) {
  const {request, organizationId, membership} = await readContext();
  const id = parseInventory(uuidSchema, idInput);
  if (membership.role === "AGENT") await getInventoryRecordRequired("listings", {id});
  const data = await executeWorkspaceOperation(() => sql.listListingActivity(request.dc, {organizationId, id}, request.options), "ListListingActivity");
  return data.activities.map(activity => {
    const metadata = activity.metadata && typeof activity.metadata === "object" ? activity.metadata as Record<string, unknown> : {};
    return {
      id: activity.id, kind: activity.kind, createdAt: activity.createdAt, actor: activity.actor?.displayName ?? null,
      from: typeof metadata.from === "string" ? metadata.from : null, to: typeof metadata.to === "string" ? metadata.to : null,
    };
  });
}

/**
 * One listing workflow step. The transition and role rules are checked here
 * for a clear message and again in SetPropertyListingStatus, which also
 * compare-and-sets on the expected status so concurrent changes conflict.
 */
export async function setListingStatus(idInput: unknown, input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId, true);
  const id = parseInventory(uuidSchema, idInput);
  // The route merges the URL id into the body; the status payload itself is strict.
  const data = parseInventory(listingStatusInputSchema, input && typeof input === "object" && !Array.isArray(input) ? without(input as Record<string, unknown>, "id") : input);
  const current = await getInventoryRecordRequired("listings", {id}) as {listingStatus: string; assignedMembershipId?: string | null};
  if (current.listingStatus !== data.expectedStatus) throw new WorkspaceError("CONFLICT", 409, "This listing's status changed. Reload and try again.");
  const allowed = allowedListingTransitions(current.listingStatus, context.membership.role, Boolean(current.assignedMembershipId) && canonicalUuid(current.assignedMembershipId!) === canonicalUuid(context.membership.id));
  if (!allowed.includes(data.status)) {
    if (context.membership.role === "AGENT") throw new WorkspaceError("FORBIDDEN", 403, "Agents may submit their listings for review or return them to draft; an administrator approves and publishes.");
    throw new WorkspaceError("VALIDATION_ERROR", 400, `A listing cannot move from ${current.listingStatus.replaceAll("_", " ")} to ${data.status.replaceAll("_", " ")}.`);
  }
  try {
    await executeWorkspaceOperation(() => sql.setPropertyListingStatus(context.request.dc, {
      organizationId: context.organizationId, id,
      expectedStatus: enumValue(sql.ListingStatus, data.expectedStatus), status: enumValue(sql.ListingStatus, data.status),
    }, context.request.options), "SetPropertyListingStatus");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/LISTING_STATUS_CHANGED|INVALID_LISTING_TRANSITION/.test(message)) throw new WorkspaceError("CONFLICT", 409, "This listing's status changed. Reload and try again.");
    throw error;
  }
  return {id, listingStatus: data.status};
}

export async function getInventoryRecord(resourceName: string, input: unknown) {
  const resource = safeResource(resourceName);
  const context = await readContext();
  const raw = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const id = parseInventory(uuidSchema, raw.id);
  if (resource === "phases") parseInventory(z.strictObject({id: uuidSchema, projectId: uuidSchema}), raw);
  else parseInventory(z.strictObject({id: uuidSchema}), raw);
  const {request, organizationId, membership} = context;
  switch (resource) {
    case "developers": return (await executeWorkspaceOperation(() => sql.getDeveloper(request.dc, {organizationId, id}, request.options), "GetDeveloper")).developer;
    case "projects": {
      const project = (await executeWorkspaceOperation(() => sql.getProject(request.dc, {organizationId, id}, request.options), "GetProject")).project;
      if (!project || revealsExactLocation(membership)) return project;
      return {...redactStoredLocation(project, project.mapDisplayMode), buildings_on_project: project.buildings_on_project.map(building => redactStoredLocation(building, project.mapDisplayMode))};
    }
    case "phases": {
      const projectId = parseInventory(uuidSchema, raw.projectId);
      return (await executeWorkspaceOperation(() => sql.getProjectPhase(request.dc, {organizationId, projectId, id}, request.options), "GetProjectPhase")).projectPhase;
    }
    case "buildings": {
      const building = (await executeWorkspaceOperation(() => sql.getBuilding(request.dc, {organizationId, id}, request.options), "GetBuilding")).building;
      return building && !revealsExactLocation(membership) ? redactStoredLocation(building, building.project.mapDisplayMode) : building;
    }
    case "properties": {
      if (membership.role !== "AGENT") return (await executeWorkspaceOperation(() => sql.getProperty(request.dc, {organizationId, id}, request.options), "GetProperty")).property;
      const property = (await executeWorkspaceOperation(() => sql.getAssignedProperty(request.dc, {organizationId, id, assignedMembershipId: membership.id}, request.options), "GetAssignedProperty")).property;
      return property && redactStoredLocation(property, property.mapDisplayMode);
    }
    case "listings": {
      const result = membership.role === "AGENT"
        ? await executeWorkspaceOperation(() => sql.getAssignedPropertyListing(request.dc, {organizationId, id, assignedMembershipId: membership.id}, request.options), "GetAssignedPropertyListing")
        : await executeWorkspaceOperation(() => sql.getPropertyListing(request.dc, {organizationId, id}, request.options), "GetPropertyListing");
      const listing = result.propertyListing;
      if (!listing || revealsExactLocation(membership)) return listing;
      // Agents see the listing's property location only as its map display mode allows.
      const property = withAuthorizedMedia(listing.property, membership);
      return {...listing, property: redactStoredLocation(property, property.mapDisplayMode)};
    }
    case "floor-plans": return (await executeWorkspaceOperation(() => sql.getFloorPlan(request.dc, {organizationId, id}, request.options), "GetFloorPlan")).floorPlan;
    case "payment-plans": return (await executeWorkspaceOperation(() => sql.getPaymentPlan(request.dc, {organizationId, id}, request.options), "GetPaymentPlan")).paymentPlan;
    case "amenities": return (await executeWorkspaceOperation(() => sql.getInventoryAmenity(request.dc, {organizationId, id}, request.options), "GetInventoryAmenity")).inventoryAmenity;
    case "features": return (await executeWorkspaceOperation(() => sql.getPropertyFeature(request.dc, {organizationId, id}, request.options), "GetPropertyFeature")).propertyFeature;
  }
}

function requireFound<T>(value: T | null | undefined, kind: string): T {
  if (value == null) throw new WorkspaceError("NOT_FOUND", 404, `This ${kind} is unavailable.`);
  return value;
}

export async function getInventoryRecordRequired(resourceName: string, input: unknown) {
  const result = await getInventoryRecord(resourceName, input);
  return requireFound(result, "inventory record");
}

export async function createInventoryRecord(resourceName: string, input: unknown, expectedOrganizationId: string | null) {
  const resource = safeResource(resourceName);
  const context = await writeContext(expectedOrganizationId, resource === "listings");
  const {request, organizationId, membership} = context;
  switch (resource) {
    case "developers": {
      const data = parseInventory(developerInputSchema, input);
      return executeWorkspaceOperation(() => sql.createDeveloper(request.dc, {
        organizationId, ...data, logoReference: data.logoReference ?? null, description: data.description ?? null,
        website: data.website ?? null, email: data.email ?? null, phone: data.phone ?? null,
        headOfficeAddress: data.headOfficeAddress ?? null, headOfficeLatitude: data.headOfficeLatitude ?? null,
        headOfficeLongitude: data.headOfficeLongitude ?? null, headOfficeGooglePlaceId: data.headOfficeGooglePlaceId ?? null,
        status: enumValue(sql.DeveloperStatus, data.status),
      }, request.options), "CreateDeveloper");
    }
    case "projects": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(projectInputSchema, input);
      return executeWorkspaceOperation(() => sql.createProject(request.dc, {
        organizationId, ...data,
        projectType: enumValue(sql.ProjectType, data.projectType), ownershipType: data.ownershipType ? enumValue(sql.OwnershipType, data.ownershipType) : null,
        emirate: data.emirate ? enumValue(sql.Emirate, data.emirate) : null,
        city: data.city ?? null, googlePlaceId: data.googlePlaceId ?? null, mapDisplayMode: enumValue(sql.MapDisplayMode, data.mapDisplayMode),
        constructionStatus: enumValue(sql.ConstructionStatus, data.constructionStatus), projectStatus: enumValue(sql.ProjectStatus, data.projectStatus),
        startingPriceMinor: data.startingPriceMinor ?? null, brochureReference: data.brochureReference ?? null,
      }, request.options), "CreateProject");
    }
    case "phases": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(phaseInputSchema, input);
      return executeWorkspaceOperation(() => sql.createProjectPhase(request.dc, {
        organizationId, ...data, status: enumValue(sql.CompletionStatus, data.status),
        reference: data.reference ?? null, description: data.description ?? null,
        expectedHandoverDate: data.expectedHandoverDate ?? null, actualHandoverDate: data.actualHandoverDate ?? null,
      }, request.options), "CreateProjectPhase");
    }
    case "buildings": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(buildingInputSchema, input);
      return executeWorkspaceOperation(() => sql.createBuilding(request.dc, {
        organizationId, ...data, phaseId: data.phaseId ?? null, reference: data.reference ?? null,
        floors: data.floors ?? null, buildingType: enumValue(sql.BuildingType, data.buildingType),
        status: enumValue(sql.CompletionStatus, data.status), handoverDate: data.handoverDate ?? null,
        latitude: data.latitude ?? null, longitude: data.longitude ?? null,
      }, request.options), "CreateBuilding");
    }
    case "properties": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(propertyInputSchema, input);
      return executeWorkspaceOperation(() => sql.createProperty(request.dc, {
        organizationId, ...data, projectId: data.projectId ?? null, buildingId: data.buildingId ?? null, unitNumber: data.unitNumber ?? null,
        propertyType: enumValue(sql.PropertyType, data.propertyType), marketType: enumValue(sql.MarketType, data.marketType), areaUnit: enumValue(sql.AreaUnit, data.areaUnit),
        furnishedStatus: data.furnishedStatus ? enumValue(sql.FurnishedStatus, data.furnishedStatus) : null,
        emirate: data.emirate ? enumValue(sql.Emirate, data.emirate) : null,
        community: data.community ?? null, area: data.area ?? null, address: data.address ?? null,
        latitude: data.latitude ?? null, longitude: data.longitude ?? null, referencePriceMinor: data.referencePriceMinor ?? null,
        city: data.city ?? null, googlePlaceId: data.googlePlaceId ?? null, mapDisplayMode: enumValue(sql.MapDisplayMode, data.mapDisplayMode),
        internalNotes: data.internalNotes ?? null, ownershipReference: data.ownershipReference ?? null, mandateReference: data.mandateReference ?? null,
        assignedMembershipId: data.assignedMembershipId ?? null,
        occupancyStatus: enumValue(sql.OccupancyStatus, data.occupancyStatus), inventoryStatus: enumValue(sql.InventoryStatus, data.inventoryStatus),
        bedrooms: data.bedrooms ?? null, bathrooms: data.bathrooms ?? null, floorNumber: data.floorNumber ?? null,
        builtUpArea: data.builtUpArea ?? null, plotArea: data.plotArea ?? null, parkingSpaces: data.parkingSpaces ?? null, view: data.view ?? null,
      }, request.options), "CreateProperty");
    }
    case "listings": {
      const data = parseInventory(listingInputSchema, input);
      if (membership.role === "AGENT" && data.assignedMembershipId !== membership.id) {
        throw new WorkspaceError("FORBIDDEN", 403, "Agents can create only listings assigned to themselves.");
      }
      if (membership.role === "AGENT" && !["DRAFT", "PENDING_REVIEW"].includes(data.listingStatus)) {
        throw new WorkspaceError("FORBIDDEN", 403, "Agents may prepare a listing for review, but only an administrator can approve or activate it.");
      }
      return executeWorkspaceOperation(() => sql.createPropertyListing(request.dc, {
        organizationId, ...data, listingPurpose: enumValue(sql.ListingPurpose, data.listingPurpose),
        marketType: enumValue(sql.MarketType, data.marketType), listingStatus: enumValue(sql.ListingStatus, data.listingStatus),
        publicationStatus: enumValue(sql.ListingPublicationStatus, data.publicationStatus),
        rentalPeriod: data.rentalPeriod ? enumValue(sql.RentalPeriod, data.rentalPeriod) : null,
        assignedMembershipId: data.assignedMembershipId ?? null, description: data.description ?? null,
        advertisingPermitNumber: data.advertisingPermitNumber ?? null, permitExpiryDate: data.permitExpiryDate ?? null,
        permitVerificationUrl: data.permitVerificationUrl ?? null,
      }, request.options), "CreatePropertyListing");
    }
    case "floor-plans": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(floorPlanInputSchema, input);
      return executeWorkspaceOperation(() => sql.createFloorPlan(request.dc, {
        organizationId, ...data, propertyId: data.propertyId ?? null, buildingId: data.buildingId ?? null, propertyType: enumValue(sql.PropertyType, data.propertyType),
        areaUnit: enumValue(sql.AreaUnit, data.areaUnit), bedrooms: data.bedrooms ?? null,
        builtUpArea: data.builtUpArea ?? null, plotArea: data.plotArea ?? null, mediaReference: data.mediaReference ?? null,
      }, request.options), "CreateFloorPlan");
    }
    case "payment-plans": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(paymentPlanCreateSchema, input);
      return createPaymentPlanWorkflow(context, data);
    }
    case "amenities": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(amenityInputSchema, input);
      return executeWorkspaceOperation(() => sql.createInventoryAmenity(request.dc, {
        organizationId, ...data, category: data.category ?? null,
      }, request.options), "CreateInventoryAmenity");
    }
    case "features": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(featureInputSchema, input);
      return executeWorkspaceOperation(() => sql.createPropertyFeature(request.dc, {
        organizationId, ...data, textValue: data.textValue ?? null, numberValue: data.numberValue ?? null,
        booleanValue: data.booleanValue ?? null, unit: data.unit ?? null, valueType: enumValue(sql.FeatureValueType, data.valueType),
      }, request.options), "CreatePropertyFeature");
    }
  }
}

async function createPaymentPlanWorkflow(context: Context, input: z.infer<typeof paymentPlanCreateSchema>) {
  const {request, organizationId} = context;
  const {installments, ...plan} = input;
  const created = await executeWorkspaceOperation(() => sql.createPaymentPlan(request.dc, {organizationId, ...plan}, request.options), "CreatePaymentPlan");
  const planId = created.paymentPlan.id;
  let expectedTotalBps = 0;
  try {
    for (const installment of installments) {
      const newTotalBps = expectedTotalBps + installment.percentageBps;
      await executeWorkspaceOperation(() => sql.addPaymentPlanInstallment(request.dc, {
        organizationId, paymentPlanId: planId, expectedTotalBps, newTotalBps, ...installment,
        dueTrigger: enumValue(sql.PaymentDueTrigger, installment.dueTrigger),
        constructionMilestonePercent: installment.constructionMilestonePercent ?? null,
        postHandoverMonths: installment.postHandoverMonths ?? null, description: installment.description ?? null,
      }, request.options), "AddPaymentPlanInstallment");
      expectedTotalBps = newTotalBps;
    }
    await executeWorkspaceOperation(() => sql.setPaymentPlanActive(request.dc, {
      organizationId, id: planId, expectedInstallmentTotalBps: expectedTotalBps, isActive: true,
    }, request.options), "ActivatePaymentPlan");
    return {paymentPlan: created.paymentPlan, installmentCount: installments.length, isActive: true};
  } catch (error) {
    // A failed child write leaves only an inactive plan; archive it through the
    // same authorized, audited connector before returning the original error.
    try { await executeWorkspaceOperation(() => sql.archivePaymentPlan(request.dc, {organizationId, id: planId}, request.options), "RollbackPaymentPlan"); } catch { /* keep the original safe failure */ }
    throw error;
  }
}

export async function updateInventoryRecord(resourceName: string, input: unknown, expectedOrganizationId: string | null) {
  const resource = safeResource(resourceName);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const context = await writeContext(expectedOrganizationId, resource === "listings");
  const {request, organizationId, membership} = context;
  const id = parseInventory(uuidSchema, raw.id);

  if (resource === "payment-plans" && typeof raw.isActive === "boolean") {
    assertOrganizationAdministrator(membership);
    const data = parseInventory(paymentPlanActivationSchema, {isActive: raw.isActive});
    const plan = requireFound((await executeWorkspaceOperation(() => sql.getPaymentPlan(request.dc, {organizationId, id}, request.options), "GetPaymentPlan")).paymentPlan, "payment plan");
    return executeWorkspaceOperation(() => sql.setPaymentPlanActive(request.dc, {
      organizationId, id, expectedInstallmentTotalBps: plan.installmentTotalBps, isActive: data.isActive,
    }, request.options), "SetPaymentPlanActive");
  }

  switch (resource) {
    case "developers": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(developerInputSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updateDeveloper(request.dc, {
        organizationId, id, ...data, logoReference: data.logoReference ?? null, description: data.description ?? null,
        website: data.website ?? null, email: data.email ?? null, phone: data.phone ?? null,
        headOfficeAddress: data.headOfficeAddress ?? null, headOfficeLatitude: data.headOfficeLatitude ?? null,
        headOfficeLongitude: data.headOfficeLongitude ?? null, headOfficeGooglePlaceId: data.headOfficeGooglePlaceId ?? null, status: enumValue(sql.DeveloperStatus, data.status),
      }, request.options), "UpdateDeveloper");
    }
    case "projects": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(projectInputSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updateProject(request.dc, {
        organizationId, id, ...data, projectType: enumValue(sql.ProjectType, data.projectType),
        ownershipType: data.ownershipType ? enumValue(sql.OwnershipType, data.ownershipType) : null,
        emirate: data.emirate ? enumValue(sql.Emirate, data.emirate) : null,
        city: data.city ?? null, googlePlaceId: data.googlePlaceId ?? null, mapDisplayMode: enumValue(sql.MapDisplayMode, data.mapDisplayMode),
        constructionStatus: enumValue(sql.ConstructionStatus, data.constructionStatus), projectStatus: enumValue(sql.ProjectStatus, data.projectStatus),
        startingPriceMinor: data.startingPriceMinor ?? null, brochureReference: data.brochureReference ?? null,
      }, request.options), "UpdateProject");
    }
    case "phases": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(phaseInputSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updateProjectPhase(request.dc, {
        organizationId, id, ...data, status: enumValue(sql.CompletionStatus, data.status),
        reference: data.reference ?? null, description: data.description ?? null,
        expectedHandoverDate: data.expectedHandoverDate ?? null, actualHandoverDate: data.actualHandoverDate ?? null,
      }, request.options), "UpdateProjectPhase");
    }
    case "buildings": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(buildingInputSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updateBuilding(request.dc, {
        organizationId, id, ...data, phaseId: data.phaseId ?? null, reference: data.reference ?? null, floors: data.floors ?? null,
        buildingType: enumValue(sql.BuildingType, data.buildingType), status: enumValue(sql.CompletionStatus, data.status),
        handoverDate: data.handoverDate ?? null, latitude: data.latitude ?? null, longitude: data.longitude ?? null,
      }, request.options), "UpdateBuilding");
    }
    case "properties": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(propertyInputSchema, without(raw, "id"));
      const current = requireFound((await executeWorkspaceOperation(() => sql.getProperty(request.dc, {organizationId, id}, request.options), "GetProperty")).property, "property");
      if (current.inventoryStatus !== data.inventoryStatus && !inventoryTransitions[current.inventoryStatus]?.includes(data.inventoryStatus)) {
        throw new WorkspaceError("VALIDATION_ERROR", 400, `A property cannot move from ${current.inventoryStatus.replaceAll("_", " ")} to ${data.inventoryStatus.replaceAll("_", " ")}.`);
      }
      return executeWorkspaceOperation(() => sql.updateProperty(request.dc, {
        organizationId, id, expectedInventoryStatus: enumValue(sql.InventoryStatus, current.inventoryStatus), ...data, projectId: data.projectId ?? null, buildingId: data.buildingId ?? null, unitNumber: data.unitNumber ?? null,
        propertyType: enumValue(sql.PropertyType, data.propertyType), marketType: enumValue(sql.MarketType, data.marketType), areaUnit: enumValue(sql.AreaUnit, data.areaUnit),
        furnishedStatus: data.furnishedStatus ? enumValue(sql.FurnishedStatus, data.furnishedStatus) : null,
        emirate: data.emirate ? enumValue(sql.Emirate, data.emirate) : null,
        community: data.community ?? null, area: data.area ?? null, address: data.address ?? null,
        latitude: data.latitude ?? null, longitude: data.longitude ?? null, referencePriceMinor: data.referencePriceMinor ?? null,
        city: data.city ?? null, googlePlaceId: data.googlePlaceId ?? null, mapDisplayMode: enumValue(sql.MapDisplayMode, data.mapDisplayMode),
        internalNotes: data.internalNotes ?? null, ownershipReference: data.ownershipReference ?? null, mandateReference: data.mandateReference ?? null,
        assignedMembershipId: data.assignedMembershipId ?? null,
        occupancyStatus: enumValue(sql.OccupancyStatus, data.occupancyStatus), inventoryStatus: enumValue(sql.InventoryStatus, data.inventoryStatus),
        bedrooms: data.bedrooms ?? null, bathrooms: data.bathrooms ?? null, floorNumber: data.floorNumber ?? null,
        builtUpArea: data.builtUpArea ?? null, plotArea: data.plotArea ?? null, parkingSpaces: data.parkingSpaces ?? null, view: data.view ?? null,
      }, request.options), "UpdateProperty");
    }
    case "listings": {
      const data = parseInventory(listingInputSchema, without(raw, "id"));
      if (membership.role === "AGENT" && data.assignedMembershipId !== membership.id) throw new WorkspaceError("FORBIDDEN", 403, "Agents can manage only listings assigned to themselves.");
      const current = await authorizeListingUpdate(context, id, data.listingStatus, data.assignedMembershipId ?? null);
      return executeWorkspaceOperation(() => sql.updatePropertyListing(request.dc, {
        organizationId, id, expectedListingStatus: enumValue(sql.ListingStatus, current.listingStatus), ...data, listingPurpose: enumValue(sql.ListingPurpose, data.listingPurpose), marketType: enumValue(sql.MarketType, data.marketType),
        listingStatus: enumValue(sql.ListingStatus, data.listingStatus), publicationStatus: enumValue(sql.ListingPublicationStatus, data.publicationStatus),
        rentalPeriod: data.rentalPeriod ? enumValue(sql.RentalPeriod, data.rentalPeriod) : null,
        assignedMembershipId: data.assignedMembershipId ?? null, description: data.description ?? null,
        advertisingPermitNumber: data.advertisingPermitNumber ?? null, permitExpiryDate: data.permitExpiryDate ?? null,
        permitVerificationUrl: data.permitVerificationUrl ?? null,
      }, request.options), "UpdatePropertyListing");
    }
    case "floor-plans": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(floorPlanInputSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updateFloorPlan(request.dc, {
        organizationId, id, ...data, propertyId: data.propertyId ?? null, buildingId: data.buildingId ?? null, propertyType: enumValue(sql.PropertyType, data.propertyType),
        areaUnit: enumValue(sql.AreaUnit, data.areaUnit), bedrooms: data.bedrooms ?? null, builtUpArea: data.builtUpArea ?? null,
        plotArea: data.plotArea ?? null, mediaReference: data.mediaReference ?? null,
      }, request.options), "UpdateFloorPlan");
    }
    case "payment-plans": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(paymentPlanInputSchema, without(raw, "id"));
      const current = requireFound((await executeWorkspaceOperation(() => sql.getPaymentPlan(request.dc, {organizationId, id}, request.options), "GetPaymentPlan")).paymentPlan, "payment plan");
      return executeWorkspaceOperation(() => sql.updatePaymentPlan(request.dc, {
        organizationId, id, ...data, expectedBookingPercentageBps: current.bookingPercentageBps,
        expectedHandoverPercentageBps: current.handoverPercentageBps, expectedInstallmentTotalBps: current.installmentTotalBps,
      }, request.options), "UpdatePaymentPlan");
    }
    case "amenities": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(z.strictObject({isActive: z.boolean()}), without(raw, "id"));
      return executeWorkspaceOperation(() => sql.setInventoryAmenityActive(request.dc, {organizationId, id, ...data}, request.options), "SetInventoryAmenityActive");
    }
    case "features": {
      assertOrganizationAdministrator(membership);
      const data = parseInventory(featureUpdateSchema, without(raw, "id"));
      return executeWorkspaceOperation(() => sql.updatePropertyFeature(request.dc, {
        organizationId, id, ...data, valueType: enumValue(sql.FeatureValueType, data.valueType),
        textValue: data.textValue ?? null, numberValue: data.numberValue ?? null,
        booleanValue: data.booleanValue ?? null, unit: data.unit ?? null,
      }, request.options), "UpdatePropertyFeature");
    }
  }
}

export async function archiveInventoryRecord(resourceName: string, input: unknown, expectedOrganizationId: string | null) {
  const resource = safeResource(resourceName);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const parsed = resource === "phases"
    ? parseInventory(z.strictObject({id: uuidSchema, projectId: uuidSchema}), raw)
    : parseInventory(z.strictObject({id: uuidSchema}), raw);
  const context = await writeContext(expectedOrganizationId, resource === "listings");
  const {request, organizationId, membership} = context;
  const id = parsed.id;
  if (resource === "listings" && membership.role === "AGENT") {
    return executeWorkspaceOperation(() => sql.archivePropertyListing(request.dc, {organizationId, id}, request.options), "ArchivePropertyListing");
  }
  assertOrganizationAdministrator(membership);
  switch (resource) {
    case "developers": return executeWorkspaceOperation(() => sql.archiveDeveloper(request.dc, {organizationId, id}, request.options), "ArchiveDeveloper");
    case "projects": return executeWorkspaceOperation(() => sql.archiveProject(request.dc, {organizationId, id}, request.options), "ArchiveProject");
    case "phases": {
      const projectId = parseInventory(uuidSchema, raw.projectId);
      return executeWorkspaceOperation(() => sql.archiveProjectPhase(request.dc, {organizationId, projectId, id}, request.options), "ArchiveProjectPhase");
    }
    case "buildings": return executeWorkspaceOperation(() => sql.archiveBuilding(request.dc, {organizationId, id}, request.options), "ArchiveBuilding");
    case "properties": return executeWorkspaceOperation(() => sql.archiveProperty(request.dc, {organizationId, id}, request.options), "ArchiveProperty");
    case "listings": return executeWorkspaceOperation(() => sql.archivePropertyListing(request.dc, {organizationId, id}, request.options), "ArchivePropertyListing");
    case "floor-plans": return executeWorkspaceOperation(() => sql.archiveFloorPlan(request.dc, {organizationId, id}, request.options), "ArchiveFloorPlan");
    case "payment-plans": return executeWorkspaceOperation(() => sql.archivePaymentPlan(request.dc, {organizationId, id}, request.options), "ArchivePaymentPlan");
    case "amenities": return executeWorkspaceOperation(() => sql.setInventoryAmenityActive(request.dc, {organizationId, id, isActive: false}, request.options), "DeactivateInventoryAmenity");
    case "features": return executeWorkspaceOperation(() => sql.archivePropertyFeature(request.dc, {organizationId, id}, request.options), "ArchivePropertyFeature");
  }
}

export async function listProjectAuditEvents(projectIdInput: unknown, input: unknown = {}) {
  const context = await readContext();
  const projectId = parseInventory(uuidSchema, projectIdInput);
  const filters = normalizeListInput(input);
  const data = await executeWorkspaceOperation(() => sql.listProjectAuditEvents(context.request.dc, {
    organizationId: context.organizationId, projectId, limit: filters.limit, offset: filters.offset,
  }, context.request.options), "ListProjectAuditEvents");
  return paged(data, filters.limit, filters.offset);
}

export async function createPaymentPlanInstallment(input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const paymentPlanId = parseInventory(uuidSchema, raw.paymentPlanId);
  const installment = parseInventory(paymentInstallmentInputSchema, without(raw, "paymentPlanId"));
  const plan = requireFound((await executeWorkspaceOperation(() => sql.getPaymentPlan(context.request.dc, {
    organizationId: context.organizationId, id: paymentPlanId,
  }, context.request.options), "GetPaymentPlan")).paymentPlan, "payment plan");
  const expectedTotalBps = plan.installmentTotalBps;
  const newTotalBps = expectedTotalBps + installment.percentageBps;
  return executeWorkspaceOperation(() => sql.addPaymentPlanInstallment(context.request.dc, {
    organizationId: context.organizationId, paymentPlanId, expectedTotalBps, newTotalBps, ...installment,
    dueTrigger: enumValue(sql.PaymentDueTrigger, installment.dueTrigger),
    constructionMilestonePercent: installment.constructionMilestonePercent ?? null,
    postHandoverMonths: installment.postHandoverMonths ?? null, description: installment.description ?? null,
  }, context.request.options), "AddPaymentPlanInstallment");
}

export async function updatePaymentPlanInstallment(input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const paymentPlanId = parseInventory(uuidSchema, raw.paymentPlanId);
  const id = parseInventory(uuidSchema, raw.id);
  const installment = parseInventory(paymentInstallmentInputSchema, without(raw, "paymentPlanId", "id"));
  const plan = requireFound((await executeWorkspaceOperation(() => sql.getPaymentPlan(context.request.dc, {
    organizationId: context.organizationId, id: paymentPlanId,
  }, context.request.options), "GetPaymentPlan")).paymentPlan, "payment plan");
  const existing = plan.paymentPlanInstallments_on_paymentPlan.find((row) => row.id === id);
  if (!existing) throw new WorkspaceError("NOT_FOUND", 404, "This payment installment is unavailable.");
  const expectedTotalBps = plan.installmentTotalBps;
  const newTotalBps = expectedTotalBps - existing.percentageBps + installment.percentageBps;
  return executeWorkspaceOperation(() => sql.updatePaymentPlanInstallment(context.request.dc, {
    organizationId: context.organizationId, paymentPlanId, id, expectedTotalBps, newTotalBps, ...installment,
    dueTrigger: enumValue(sql.PaymentDueTrigger, installment.dueTrigger),
    constructionMilestonePercent: installment.constructionMilestonePercent ?? null,
    postHandoverMonths: installment.postHandoverMonths ?? null, description: installment.description ?? null,
  }, context.request.options), "UpdatePaymentPlanInstallment");
}

export async function removePaymentPlanInstallment(input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const parsed = parseInventory(z.strictObject({paymentPlanId: uuidSchema, id: uuidSchema}), raw);
  const paymentPlanId = parsed.paymentPlanId;
  const id = parsed.id;
  const plan = requireFound((await executeWorkspaceOperation(() => sql.getPaymentPlan(context.request.dc, {
    organizationId: context.organizationId, id: paymentPlanId,
  }, context.request.options), "GetPaymentPlan")).paymentPlan, "payment plan");
  const existing = plan.paymentPlanInstallments_on_paymentPlan.find((row) => row.id === id);
  if (!existing) throw new WorkspaceError("NOT_FOUND", 404, "This payment installment is unavailable.");
  return executeWorkspaceOperation(() => sql.removePaymentPlanInstallment(context.request.dc, {
    organizationId: context.organizationId, paymentPlanId, id,
    expectedTotalBps: plan.installmentTotalBps, newTotalBps: plan.installmentTotalBps - existing.percentageBps,
  }, context.request.options), "RemovePaymentPlanInstallment");
}

export async function attachInventoryAmenity(resource: "projects" | "properties", parentIdInput: unknown, input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const parentId = parseInventory(uuidSchema, parentIdInput);
  const body = parseInventory(z.strictObject({amenityId: uuidSchema}), input);
  if (resource === "properties") return executeWorkspaceOperation(() => sql.attachPropertyAmenity(context.request.dc, {
    organizationId: context.organizationId, propertyId: parentId, amenityId: body.amenityId,
  }, context.request.options), "AttachPropertyAmenity");
  return executeWorkspaceOperation(() => sql.attachProjectAmenity(context.request.dc, {
    organizationId: context.organizationId, projectId: parentId, amenityId: body.amenityId,
  }, context.request.options), "AttachProjectAmenity");
}

export async function detachInventoryAmenity(resource: "projects" | "properties", parentIdInput: unknown, input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const parentId = parseInventory(uuidSchema, parentIdInput);
  const body = parseInventory(z.strictObject({amenityId: uuidSchema}), input);
  if (resource === "properties") return executeWorkspaceOperation(() => sql.detachPropertyAmenity(context.request.dc, {
    organizationId: context.organizationId, propertyId: parentId, amenityId: body.amenityId,
  }, context.request.options), "DetachPropertyAmenity");
  return executeWorkspaceOperation(() => sql.detachProjectAmenity(context.request.dc, {
    organizationId: context.organizationId, projectId: parentId, amenityId: body.amenityId,
  }, context.request.options), "DetachProjectAmenity");
}

export function assertInventoryResource(resource: string): InventoryResource { return safeResource(resource); }

export async function listEligibleInventoryAgents() {
  const context = await readContext();
  assertOrganizationAdministrator(context.membership);
  const data = await executeWorkspaceOperation(() => sql.listActiveInventoryAgents(context.request.dc, {
    organizationId: context.organizationId, limit: 100,
  }, context.request.options), "ListActiveInventoryAgents");
  return data.memberships;
}

export async function getInventoryMembershipId() {
  return (await readContext()).membership.id;
}

export async function createInventoryMediaRecord(input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const data = parseInventory(inventoryMediaUploadSchema, input);
  const parentField = data.parentType === "properties" ? "propertyId" : data.parentType === "projects" ? "projectId" : "floorPlanId";
  const extensionByType: Record<string, string> = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf"};
  const generatedPath = `organizations/${context.organizationId}/${data.parentType}/${data.parentId}/${randomUUID()}.${extensionByType[data.contentType]}`;
  const result = await executeWorkspaceOperation(() => sql.createInventoryMedia(context.request.dc, {
    organizationId: context.organizationId,
    propertyId: parentField === "propertyId" ? data.parentId : null,
    projectId: parentField === "projectId" ? data.parentId : null,
    floorPlanId: parentField === "floorPlanId" ? data.parentId : null,
    storagePath: generatedPath, fileName: data.fileName, contentType: data.contentType,
    byteSize: String(data.byteSize), mediaKind: enumValue(sql.InventoryMediaKind, data.mediaKind), sortOrder: 0,
  }, context.request.options), "CreateInventoryMedia");
  return {id: result.inventoryMedia.id, storagePath: generatedPath, fileName: data.fileName};
}

export async function getInventoryMediaRecord(idInput: unknown) {
  const context = await readContext();
  const id = parseInventory(uuidSchema, idInput);
  const result = context.membership.role === "AGENT"
    ? await executeWorkspaceOperation(() => sql.getAssignedPropertyInventoryMedia(context.request.dc, {
        organizationId: context.organizationId, id, assignedMembershipId: context.membership.id,
      }, context.request.options), "GetAssignedPropertyInventoryMedia")
    : await executeWorkspaceOperation(() => sql.getInventoryMedia(context.request.dc, {
        organizationId: context.organizationId, id,
      }, context.request.options), "GetInventoryMedia");
  const media = result.inventoryMedias[0];
  if (!media) throw new WorkspaceError("NOT_FOUND", 404, "This inventory file is unavailable.");
  return {context, media};
}

export async function getInventoryMediaForDeletion(idInput: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const id = parseInventory(uuidSchema, idInput);
  const result = await executeWorkspaceOperation(() => sql.getInventoryMediaForDeletion(context.request.dc, {
    organizationId: context.organizationId, id,
  }, context.request.options), "GetInventoryMediaForDeletion");
  const media = result.inventoryMedias[0];
  if (!media) throw new WorkspaceError("NOT_FOUND", 404, "This inventory file is unavailable.");
  return {context, media};
}

export async function updateInventoryMediaStatus(idInput: unknown, expectedStatus: string, status: string, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const id = parseInventory(uuidSchema, idInput);
  const expected = enumValue(sql.InventoryMediaStatus, expectedStatus);
  const next = enumValue(sql.InventoryMediaStatus, status);
  return executeWorkspaceOperation(() => sql.setInventoryMediaStatus(context.request.dc, {
    organizationId: context.organizationId, id, expectedStatus: expected, status: next,
  }, context.request.options), "SetInventoryMediaStatus");
}

export async function updateInventoryMediaOrder(idInput: unknown, input: unknown, expectedOrganizationId: string | null) {
  const context = await writeContext(expectedOrganizationId);
  const id = parseInventory(uuidSchema, idInput);
  const data = parseInventory(z.strictObject({sortOrder: z.number().int().min(0).max(500), isCover: z.boolean()}), input);
  if (data.isCover) {
    const current = await executeWorkspaceOperation(() => sql.getInventoryMedia(context.request.dc, {
      organizationId: context.organizationId, id,
    }, context.request.options), "GetInventoryMedia");
    const media = current.inventoryMedias[0];
    if (!media || media.status !== "ACTIVE" || !media.propertyId || media.mediaKind !== "PROPERTY_PHOTO" || !media.contentType.startsWith("image/")) {
      throw new WorkspaceError("VALIDATION_ERROR", 400, "Only an active property photo can be selected as the cover image.");
    }
    return executeWorkspaceOperation(() => sql.setPropertyMediaCover(context.request.dc, {
      organizationId: context.organizationId, propertyId: media.propertyId!, id, sortOrder: data.sortOrder,
    }, context.request.options), "SetPropertyMediaCover");
  }
  return executeWorkspaceOperation(() => sql.updateInventoryMediaOrder(context.request.dc, {
    organizationId: context.organizationId, id, ...data,
  }, context.request.options), "UpdateInventoryMediaOrder");
}

