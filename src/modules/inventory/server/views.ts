import "server-only";

import type {
  GetDeveloperData, GetProjectData, ListBuildingsData, ListDevelopersData, ListFloorPlansData,
  GetPropertyData, GetPropertyListingData, ListInventoryAmenitiesData, ListPaymentPlansData, ListProjectAuditEventsData, ListProjectPhasesData,
  ListProjectsData, ListPropertiesAdvancedData, ListPropertiesData, ListPropertyListingsData,
} from "@dataconnect/admin-generated";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { getInventoryMembershipId, listEligibleInventoryAgents, listInventory, listInventoryMapPins, listListingActivity, listProjectAuditEvents, listingStatusCounts, getInventoryRecordRequired } from "./service";
import { allowedListingTransitions, buildListingListOperationInput, buildPropertyListOperationInput, type ListingListPageInput, type PropertyListPageInput } from "../validation";
import { presentMapLocation, withoutRawLocation, type DisplayLocation, type MapBounds } from "@/modules/maps/geo";

type PageResult<T> = { total: number; limit: number; offset: number; hasNext: boolean } & T;
type Developer = NonNullable<GetDeveloperData["developer"]>;
type Project = NonNullable<GetProjectData["project"]>;
type DeveloperList = PageResult<{developers: ListDevelopersData["developers"]}>;
type ProjectList = PageResult<{projects: ListProjectsData["projects"]}>;
type PhaseList = PageResult<{projectPhases: ListProjectPhasesData["projectPhases"]}>;
type BuildingList = PageResult<{buildings: ListBuildingsData["buildings"]}>;
type UnitList = PageResult<{properties: ListPropertiesData["properties"]}>;
type PropertyList = PageResult<{properties: ListPropertiesAdvancedData["properties"]}>;
type ListingList = PageResult<{propertyListings: ListPropertyListingsData["propertyListings"]}>;
type Property = NonNullable<GetPropertyData["property"]>;
type Listing = NonNullable<GetPropertyListingData["propertyListing"]>;
type FloorPlanList = PageResult<{floorPlans: ListFloorPlansData["floorPlans"]}>;
type PaymentPlanList = PageResult<{paymentPlans: ListPaymentPlansData["paymentPlans"]}>;
type AmenityList = PageResult<{inventoryAmenities: ListInventoryAmenitiesData["inventoryAmenities"]}>;
type AuditList = PageResult<{auditLogs: ListProjectAuditEventsData["auditLogs"]}>;

const sameId = (left: string | null | undefined, right: string | null | undefined) => Boolean(left && right && canonicalUuid(left) === canonicalUuid(right));

export async function getInventoryWorkspace() {
  const workspace = await requireCompanyWorkspace();
  const company = workspace.activeCompany;
  return {
    company,
    canManage: company.role === "OWNER" || company.role === "ADMIN",
  };
}

export async function getDeveloperListData(input: {search?: string; page: number}) {
  const workspace = await getInventoryWorkspace();
  const result = await listInventory("developers", {search: input.search, limit: 25, offset: (input.page - 1) * 25}) as DeveloperList;
  return {...workspace, ...result};
}

export async function getDeveloperDetailData(id: string) {
  const workspace = await getInventoryWorkspace();
  const developer = await getInventoryRecordRequired("developers", {id}) as Developer;
  const projects = await listInventory("projects", {developerId: developer.id, limit: 25, offset: 0}) as ProjectList;
  // A head office is business contact information, so it is always presented exactly.
  const headOffice = presentMapLocation({latitude: developer.headOfficeLatitude, longitude: developer.headOfficeLongitude,
    googlePlaceId: developer.headOfficeGooglePlaceId, mapDisplayMode: "EXACT"}, {revealExact: workspace.canManage});
  return {...workspace, developer, headOffice, projects: {...projects, projects: projects.projects.map(withoutRawLocation)}};
}

export async function getDeveloperFormData(id?: string) {
  const workspace = await getInventoryWorkspace();
  const developer = id ? await getInventoryRecordRequired("developers", {id}) as Developer : null;
  return {...workspace, developer};
}

export async function getProjectListData(input: {search?: string; status?: string; emirate?: string; developerId?: string; page: number}) {
  const workspace = await getInventoryWorkspace();
  const [projects, developers] = await Promise.all([
    listInventory("projects", {
      search: input.search, projectStatus: input.status, emirate: input.emirate,
      developerId: input.developerId, limit: 25, offset: (input.page - 1) * 25,
    }) as Promise<ProjectList>,
    listInventory("developers", {limit: 100, offset: 0}) as Promise<DeveloperList>,
  ]);
  return {...workspace, ...projects, developers: developers.developers};
}

export async function getProjectFormData(id?: string) {
  const workspace = await getInventoryWorkspace();
  const [project, developers, amenities] = await Promise.all([
    id ? getInventoryRecordRequired("projects", {id}) as Promise<Project> : Promise.resolve(null),
    listInventory("developers", {limit: 100, offset: 0}) as Promise<DeveloperList>,
    listInventory("amenities", {limit: 100, offset: 0}) as Promise<AmenityList>,
  ]);
  return {...workspace, project, developers: developers.developers, amenities: amenities.inventoryAmenities.filter(item => item.isActive)};
}

export async function getProjectDetailData(id: string) {
  const workspace = await getInventoryWorkspace();
  const storedProject = await getInventoryRecordRequired("projects", {id}) as Project;
  // Exact points stay server-side unless the viewer can already edit the project.
  const location = presentMapLocation(storedProject, {revealExact: workspace.canManage});
  const project = {...withoutRawLocation(storedProject), buildings_on_project: storedProject.buildings_on_project.map(withoutRawLocation)};
  const [phases, buildings, units, floorPlans, paymentPlans, audit, amenities] = await Promise.all([
    listInventory("phases", {projectId: project.id, limit: 100, offset: 0}) as Promise<PhaseList>,
    listInventory("buildings", {projectId: project.id, limit: 100, offset: 0}) as Promise<BuildingList>,
    listInventory("properties", {projectId: project.id, limit: 25, offset: 0}) as Promise<UnitList>,
    listInventory("floor-plans", {projectId: project.id, limit: 25, offset: 0}) as Promise<FloorPlanList>,
    listInventory("payment-plans", {projectId: project.id, limit: 25, offset: 0}) as Promise<PaymentPlanList>,
    listProjectAuditEvents(project.id, {limit: 25, offset: 0}) as Promise<AuditList>,
    listInventory("amenities", {limit: 100, offset: 0}) as Promise<AmenityList>,
  ]);
  // Building markers inherit the project's display mode: they are shown only
  // when the project location itself is exact.
  const showBuildings = workspace.canManage || location.display.precision === "EXACT";
  const buildingMarkers = showBuildings ? buildings.buildings.flatMap(building => {
    if (building.latitude == null || building.longitude == null) return [];
    const marker = presentMapLocation({...building, mapDisplayMode: "EXACT"}, {revealExact: false}).display;
    return [{id: building.id, name: building.name, reference: building.reference ?? null, location: marker}];
  }) : [];
  return {
    ...workspace, project, location, buildingMarkers, phases, audit, units, floorPlans, paymentPlans,
    buildings: showBuildings ? buildings : {...buildings, buildings: buildings.buildings.map(building => ({...withoutRawLocation(building), latitude: null, longitude: null}))},
    amenities: amenities.inventoryAmenities.filter(item => item.isActive),
  };
}

export type PropertyMapPin = {
  id: string; propertyReference: string; propertyType: string; marketType: string; inventoryStatus: string;
  bedrooms?: number | null; bathrooms?: number | null; builtUpArea?: number | null; areaUnit: string; unitNumber?: string | null;
  emirate?: string | null; city?: string | null; community?: string | null; area?: string | null; referencePriceMinor?: string | null;
  project?: {projectName: string}; building?: {name: string}; coverMediaId: string | null; location: DisplayLocation;
};
export type ListingMapPin = {
  id: string; listingReference: string; listingPurpose: string; marketType: string; title: string; askingPriceMinor: string;
  currency: string; rentalPeriod?: string | null; listingStatus: string; location: DisplayLocation;
  property: {id: string; propertyReference: string; propertyType: string; bedrooms?: number | null; emirate?: string | null; city?: string | null; community?: string | null; project?: {projectName: string}};
};
/** One page of sanitized pins; see listInventoryMapPins for the count semantics. */
export type InventoryMapData<T> = {
  total: number; mapped: number; mappedAll: number; limit: number; offset: number; hasMore: boolean;
  bounds: MapBounds | null; pins: T[];
  /** The normalized filters, repeated by the browser for viewport and paging requests. */
  query: Record<string, string>;
};

/** The first map page ignores the table's paging; the map pages separately. */
const firstMapPage = (input: Record<string, unknown>) => ({...input, limit: undefined, offset: undefined});
const mapQuery = (input: Record<string, unknown>) => Object.fromEntries(Object.entries(firstMapPage(input))
  .filter(([, value]) => value != null && value !== "").map(([key, value]) => [key, String(value)]));
async function mapPins<T>(resource: "properties" | "listings", input: Record<string, unknown>): Promise<InventoryMapData<T>> {
  const page = await listInventoryMapPins(resource, firstMapPage(input));
  return {...page, pins: page.pins as T[], query: mapQuery(input)};
}

export async function getPropertyListData(input: PropertyListPageInput & {view?: string}) {
  const workspace = await getInventoryWorkspace();
  const {view, ...filters} = input;
  const operationInput = buildPropertyListOperationInput(filters);
  const [properties, projects, developers, agents, map] = await Promise.all([
    listInventory("properties", operationInput) as Promise<PropertyList>,
    listInventory("projects", {limit: 100, offset: 0}) as Promise<ProjectList>,
    listInventory("developers", {limit: 100, offset: 0}) as Promise<DeveloperList>,
    workspace.canManage ? listEligibleInventoryAgents() : Promise.resolve([]),
    view === "map" ? mapPins<PropertyMapPin>("properties", operationInput) : Promise.resolve(null),
  ]);
  // Project options feed a client component; they never need coordinates.
  return {...workspace, ...properties, projects: projects.projects.map(withoutRawLocation), developers: developers.developers, agents, map};
}

export async function getPropertyFormData(id?: string) {
  const workspace = await getInventoryWorkspace();
  const [property, projects, developers, agents, amenities] = await Promise.all([
    id ? getInventoryRecordRequired("properties", {id}) as Promise<Property> : Promise.resolve(null),
    listInventory("projects", {limit: 100, offset: 0}) as Promise<ProjectList>,
    listInventory("developers", {limit: 100, offset: 0}) as Promise<DeveloperList>,
    workspace.canManage ? listEligibleInventoryAgents() : Promise.resolve([]),
    listInventory("amenities", {limit: 100, offset: 0}) as Promise<AmenityList>,
  ]);
  const buildings = await listInventory("buildings", {limit: 100, offset: 0}) as PageResult<{buildings: ListBuildingsData["buildings"]}>;
  return {...workspace, property, projects: projects.projects.map(withoutRawLocation), developers: developers.developers, agents, buildings: buildings.buildings, amenities: amenities.inventoryAmenities.filter(item => item.isActive)};
}

export async function getPropertyDetailData(id: string) {
  const workspace = await getInventoryWorkspace();
  const storedProperty = await getInventoryRecordRequired("properties", {id}) as Property;
  const listings = await listInventory("listings", {propertyId: id, limit: 100, offset: 0}) as ListingList;
  // PropertyDetail is a client component: raw coordinates and place IDs are
  // removed here and only the mode-aware location is serialized.
  const location = presentMapLocation(storedProperty, {revealExact: workspace.canManage});
  return {...workspace, property: withoutRawLocation(storedProperty), location, listings: listings.propertyListings};
}

export async function getListingListData(input: ListingListPageInput & {view?: string}) {
  const workspace = await getInventoryWorkspace();
  const {view, ...filters} = input;
  const operationInput = buildListingListOperationInput(filters);
  const [result, map, statusCounts, currentMembershipId] = await Promise.all([
    listInventory("listings", operationInput) as Promise<ListingList>,
    view === "map" ? mapPins<ListingMapPin>("listings", operationInput) : Promise.resolve(null),
    listingStatusCounts(),
    getInventoryMembershipId(),
  ]);
  const role = workspace.company.role;
  return {
    ...workspace, ...result, map, statusCounts,
    // Next workflow steps this viewer may take, per row.
    transitions: Object.fromEntries(result.propertyListings.map(listing => [listing.id,
      allowedListingTransitions(listing.listingStatus, role, sameId(listing.assignedMembershipId, currentMembershipId))])),
  };
}

export async function getListingFormData(id?: string) {
  const workspace = await getInventoryWorkspace();
  const [listing, properties, agents, currentMembershipId] = await Promise.all([
    id ? getInventoryRecordRequired("listings", {id}) as Promise<Listing> : Promise.resolve(null),
    listInventory("properties", {limit: 100, offset: 0}) as Promise<PropertyList>,
    workspace.canManage ? listEligibleInventoryAgents() : Promise.resolve([]),
    getInventoryMembershipId(),
  ]);
  // The form never needs the property's coordinates.
  return {...workspace, listing: listing && {...listing, property: withoutRawLocation(listing.property)}, properties: properties.properties, agents, currentMembershipId};
}

export async function getListingDetailData(id: string) {
  const workspace = await getInventoryWorkspace();
  const [listing, history, currentMembershipId] = await Promise.all([
    getInventoryRecordRequired("listings", {id}) as Promise<Listing>,
    listListingActivity(id),
    getInventoryMembershipId(),
  ]);
  // ListingDetail is a client component: only the mode-aware location is serialized.
  const location = presentMapLocation(listing.property, {revealExact: workspace.canManage});
  return {
    ...workspace, listing: {...listing, property: withoutRawLocation(listing.property)}, location, history,
    transitions: allowedListingTransitions(listing.listingStatus, workspace.company.role, sameId(listing.assignedMembershipId, currentMembershipId)),
  };
}
