import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { getInventoryRecord, listInventory } from "@/modules/inventory/server/service";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import type { ApprovedBranding, UnitRecord } from "@/modules/ai/content/facts";
import { collect } from "@/modules/ai/tools/records";
import { sectionWidgets, type PageData } from "../registry";
import { mediaByIds } from "./media";
import {
  buildLinkedData, uploadIdsOf, type AgentSource, type FloorPlanSource, type LinkedData, type LinkedSources, type ListingSource, type MediaSource, type PaymentPlanSource, type ProjectSource, type PropertySource,
} from "../linked";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

export interface PageSourceSelection { projectId?: string | null; propertyId?: string | null; listingId?: string | null; comparisonIds?: string[]; agentIds?: string[]; uploadIds?: string[] }

/*
 * Reads a page's linked records through the same permission-checked services
 * as the CRM screens: organization scope, role rules (agents: assigned
 * inventory only; managers: no inventory) and map privacy apply unchanged.
 * Browser-supplied IDs are only references. "Not found" and "not permitted"
 * look the same. Nothing is written.
 */

const unavailable = () => new WorkspaceError("SOURCE_UNAVAILABLE", 404, "A record linked to this page is unavailable or outside the records you can use. Choose it again.");

async function read<T>(load: () => Promise<T | null | undefined>, required: boolean, notes: string[], note: string): Promise<T | null> {
  try {
    const record = await load();
    if (record == null) { if (required) throw unavailable(); notes.push(note); return null; }
    return record;
  } catch (error) {
    if (error instanceof WorkspaceError && (error.status === 503 || error.status === 504 || error.code === "RATE_LIMITED")) throw error;
    if (required) throw error instanceof WorkspaceError && error.code === "SOURCE_UNAVAILABLE" ? error : unavailable();
    notes.push(note);
    return null;
  }
}

async function list<T>(resource: string, input: Record<string, unknown>, key: string) {
  const data = await listInventory(resource, input) as unknown as Record<string, unknown> & {total: number};
  return {rows: (data[key] as T[] | undefined) ?? [], total: data.total};
}

const hasInventoryScope = (context: Context) => context.membership.role !== "MANAGER";

/**
 * @param required  true for generation and publication: an inaccessible
 *   primary source stops the operation. The editor passes false so a page
 *   still opens, with a note, when a record was archived or reassigned.
 */
export async function loadLinkedData(context: Context, selection: PageSourceSelection, options: {branding: ApprovedBranding; mediaUrl: (id: string) => string; uploadUrl?: (id: string) => string; required: boolean}): Promise<LinkedData> {
  const notes: string[] = [];
  const sources: LinkedSources = {unavailable: notes, media: []};
  const media: MediaSource[] = [];
  const agents = selection.agentIds?.length ? () => loadAgents(context, selection.agentIds!, notes) : null;
  // Website library images belong to the company, not to the linked records, so every role reads them.
  if (selection.uploadIds?.length) sources.uploads = await mediaByIds(context, selection.uploadIds);
  const build = () => buildLinkedData(sources, options.branding, {readAt: new Date().toISOString(), mediaUrl: options.mediaUrl, uploadUrl: options.uploadUrl});
  const wantsInventory = Boolean(selection.projectId || selection.propertyId || selection.listingId || selection.comparisonIds?.length);
  if (wantsInventory && !hasInventoryScope(context)) {
    if (options.required) throw new WorkspaceError("FORBIDDEN", 403, "Your role has no inventory access in EstateOS, so pages linked to projects, properties or listings are unavailable to you.");
    notes.push("Your role has no inventory access, so linked CRM data is not shown.");
    if (agents) sources.agents = await agents();
    return build();
  }
  // Sequential on purpose: an inaccessible primary source stops before more data is read.
  if (selection.listingId) {
    const listing = await read(() => getInventoryRecord("listings", {id: selection.listingId}) as Promise<(ListingSource & {property: ListingSource["property"] & {inventoryMedias_on_property?: MediaSource[]}}) | null>,
      options.required, notes, "The page's listing is no longer available to you.");
    if (listing) {
      sources.listing = listing;
      media.push(...(listing.property.inventoryMedias_on_property ?? []));
    }
  }
  if (selection.propertyId) {
    const property = await read(() => getInventoryRecord("properties", {id: selection.propertyId}) as Promise<(PropertySource & {inventoryMedias_on_property?: MediaSource[]}) | null>,
      options.required, notes, "The page's property is no longer available to you.");
    if (property) {
      sources.property = property;
      media.push(...(property.inventoryMedias_on_property ?? []));
    }
  }
  if (selection.projectId) {
    const project = await read(() => getInventoryRecord("projects", {id: selection.projectId}) as Promise<(ProjectSource & {developer?: {id: string; name: string} | null}) | null>,
      options.required, notes, "The page's project is no longer available to you.");
    if (project) {
      sources.project = project;
      const projectId = canonicalUuid(project.id);
      const agent = context.membership.role === "AGENT";
      const [plans, units, floorPlans, developer, projectMedia] = await Promise.allSettled([
        list<PaymentPlanSource>("payment-plans", {projectId, limit: 20, offset: 0}, "paymentPlans"),
        collect<UnitRecord>((limit, offset) => list("properties", {projectId, inventoryStatus: "AVAILABLE", limit, offset}, "properties"), () => true, 300),
        list<FloorPlanSource>("floor-plans", {projectId, limit: 50, offset: 0}, "floorPlans"),
        project.developer?.id ? getInventoryRecord("developers", {id: canonicalUuid(project.developer.id)}) as Promise<{name: string; description?: string | null} | null> : Promise.resolve(null),
        executeWorkspaceOperation(() => sql.listProjectWebsiteMedia(context.request.dc, {
          organizationId: context.organizationId, projectId, includeProjectFiles: !agent, limit: 40, ...(agent ? {assignedMembershipId: context.membership.id} : {}),
        }, context.request.options), "ListProjectWebsiteMedia"),
      ]);
      if (plans.status === "fulfilled") sources.paymentPlans = plans.value.rows; else notes.push("Payment plans are not available to you.");
      if (units.status === "fulfilled") sources.units = {rows: units.value.rows, complete: units.value.complete}; else notes.push("Unit availability is not available to you.");
      if (floorPlans.status === "fulfilled") {
        sources.floorPlans = floorPlans.value.rows;
        for (const plan of floorPlans.value.rows) media.push(...(plan.inventoryMedias_on_floorPlan ?? []).map(item => ({...item, mediaKind: "FLOOR_PLAN"})));
      } else notes.push("Floor plans are not available to you.");
      if (developer.status === "fulfilled" && developer.value) sources.developer = developer.value;
      if (projectMedia.status === "fulfilled") media.push(...(projectMedia.value.projectMedia ?? []), ...projectMedia.value.unitMedia);
      else notes.push("Project photos are not available to you.");
    }
  }
  if (selection.comparisonIds?.length) {
    const rows: ListingSource[] = [];
    for (const id of selection.comparisonIds.slice(0, 4)) {
      const listing = await read(() => getInventoryRecord("listings", {id}) as Promise<ListingSource | null>, false, notes, "A comparison listing is no longer available to you.");
      if (listing) rows.push(listing);
    }
    sources.comparison = rows;
  }
  sources.media = media;
  if (agents) sources.agents = await agents();
  return build();
}

/** Active company members chosen as agents; inactive or unknown members are left out with a note. */
async function loadAgents(context: Context, ids: string[], notes: string[]): Promise<AgentSource[]> {
  const rows: AgentSource[] = [];
  for (const id of ids.slice(0, 4)) {
    const data = await executeWorkspaceOperation(() => sql.getWebsiteAgent(context.request.dc, {organizationId: context.organizationId, membershipId: id}, context.request.options), "GetWebsiteAgent");
    if (data.agent) rows.push(data.agent); else notes.push("An agent chosen for a contact section is no longer an active member.");
  }
  return rows;
}

/** Records referenced inside the page data (comparison listings and contact agents). */
export function pageRefsOf(data: PageData) {
  const agentIds = new Set<string>();
  for (const section of data.sections) {
    const ids = section.type === "CONTACT" ? [section.props.agentId] : sectionWidgets(section).flatMap(item => item.widget.type === "CONTACT_CARD" ? [item.widget.props.agentId] : []);
    for (const agentId of ids) if (agentId) agentIds.add(canonicalUuid(agentId));
  }
  return {comparisonIds: comparisonIdsOf(data), agentIds: [...agentIds], uploadIds: uploadIdsOf(data)};
}

/** Comparison listings referenced anywhere in the page data. */
export function comparisonIdsOf(data: {sections: Array<{type: string; props: unknown}>}) {
  const ids = new Set<string>();
  for (const section of data.sections) {
    if (section.type === "COMPARISON") for (const id of (section.props as {listingIds: string[]}).listingIds) ids.add(canonicalUuid(id));
  }
  return [...ids];
}

/** Authenticated preview URL for editor images; the inventory media route re-checks access on every request. */
export const editorMediaUrl = (id: string) => `/api/inventory/media/${encodeURIComponent(canonicalUuid(id))}/content`;
