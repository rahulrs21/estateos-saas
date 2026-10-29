import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { validateInput } from "@/modules/organizations/server/validation";
import { assertExpectedOrganization } from "@/modules/leads/server/request-policy";
import { portalAdapters } from "../adapters";
import { buildFeedDryRun, buildPortalExport } from "../export";
import {
  feedDryRunSchema, portalPreviewSchema, recordListingValidationSchema, removePortalFieldMappingSchema,
  savePortalConnectionSchema, setPortalFieldMappingSchema,
} from "../input-validation";
import { portalProviders, type PortalConnectionStatusCode } from "../types";

const FEED_PAGE_SIZE = 100;
/** Dry runs review at most this many ACTIVE listings; the UI discloses the bound. */
export const FEED_DRY_RUN_LIMIT = 500;

/** Portal administration is limited to OWNER/ADMIN; the stored operations re-check it. */
async function adminContext(expectedOrganizationId?: string | null) {
  const context = await requireActiveOrganizationRequest();
  if (expectedOrganizationId !== undefined) assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  assertOrganizationAdministrator(context.membership);
  return context;
}

export async function getPortalSettings() {
  const {request, organizationId} = await adminContext();
  const [data, agents] = await Promise.all([
    executeWorkspaceOperation(() => sql.getPortalSettings(request.dc, {organizationId}, request.options), "GetPortalSettings"),
    executeWorkspaceOperation(() => sql.listActiveInventoryAgents(request.dc, {organizationId, limit: 100}, request.options), "ListActiveInventoryAgents"),
  ]);
  const providers = portalProviders.map(provider => {
    const adapter = portalAdapters[provider];
    const connection = data.connections.find(row => row.provider === provider);
    return {
      provider, displayName: adapter.displayName, description: adapter.description, specificationStatus: adapter.specificationStatus,
      // Absence of a row means the provider has never been configured.
      status: (connection?.status ?? "NOT_CONFIGURED") as PortalConnectionStatusCode,
      accountReference: connection?.accountReference ?? null, notes: connection?.notes ?? null,
      lastVerifiedAt: connection?.lastVerifiedAt ?? null, lastErrorCode: connection?.lastErrorCode ?? null,
      updatedAt: connection?.updatedAt ?? null,
      mappings: data.mappings.filter(row => row.provider === provider).map(row => ({...row, id: canonicalUuid(row.id)})),
      publicationCounts: data.publicationCounts.filter(row => row.provider === provider).map(row => ({status: row.status, count: row.count})),
      jobs: data.recentJobs.filter(row => row.provider === provider).slice(0, 5).map(row => ({...row, id: canonicalUuid(row.id)})),
    };
  });
  return {
    organizationId: canonicalUuid(organizationId), providers, feedDryRunLimit: FEED_DRY_RUN_LIMIT,
    agents: agents.memberships.map(row => ({id: canonicalUuid(row.id), name: row.userProfile?.displayName || row.email})),
  };
}
export type PortalSettingsData = Awaited<ReturnType<typeof getPortalSettings>>;

export async function savePortalConnection(input: unknown, expectedOrganizationId: string | null) {
  const data = validateInput(savePortalConnectionSchema, input);
  const {request, organizationId} = await adminContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.savePortalConnection(request.dc, {
    organizationId, provider: sql.PortalProvider[data.provider], status: sql.PortalConnectionStatus[data.status],
    accountReference: data.accountReference ?? null, notes: data.notes ?? null, expectedUpdatedAt: data.expectedUpdatedAt ?? null,
  }, request.options), "SavePortalConnection");
}

export async function setPortalFieldMapping(input: unknown, expectedOrganizationId: string | null) {
  const data = validateInput(setPortalFieldMappingSchema, input);
  const {request, organizationId} = await adminContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.setPortalFieldMapping(request.dc, {...data, organizationId, provider: sql.PortalProvider[data.provider]}, request.options), "SetPortalFieldMapping");
}

export async function removePortalFieldMapping(input: unknown, expectedOrganizationId: string | null) {
  const {id} = validateInput(removePortalFieldMappingSchema, input);
  const {request, organizationId} = await adminContext(expectedOrganizationId);
  return executeWorkspaceOperation(() => sql.removePortalFieldMapping(request.dc, {organizationId, id}, request.options), "RemovePortalFieldMapping");
}

async function loadExport(context: Awaited<ReturnType<typeof adminContext>>, listingId: string, provider: string) {
  const {request, organizationId} = context;
  const data = await executeWorkspaceOperation(() => sql.getPortalExportListing(request.dc, {organizationId, listingId}, request.options), "GetPortalExportListing");
  // The stored query already fails for missing or foreign listings; this guards the type.
  if (!data.listing) throw new Error("Listing query returned no row.");
  return {data, listing: data.listing, result: buildPortalExport(provider, data.listing, data.mappings, new Date())};
}

export async function getPortalExportPreview(input: unknown) {
  const {listingId, provider} = validateInput(portalPreviewSchema, input);
  const context = await adminContext();
  const {listing, result} = await loadExport(context, listingId, provider);
  return {
    organizationId: canonicalUuid(context.organizationId),
    listing: {id: canonicalUuid(listing.id), listingReference: listing.listingReference, title: listing.title},
    provider, adapter: {displayName: portalAdapters[provider].displayName, specificationStatus: portalAdapters[provider].specificationStatus},
    normalized: result.normalized, issues: result.issues, json: result.json, xml: result.xml, payloadHash: result.payloadHash, ready: result.ready,
    publications: listing.listingPublications_on_listing.map(row => ({...row, id: canonicalUuid(row.id),
      attempts: row.publicationAttempts_on_publication.map(attempt => ({...attempt, id: canonicalUuid(attempt.id)}))})),
  };
}
export type PortalExportPreview = Awaited<ReturnType<typeof getPortalExportPreview>>;

/** Recomputes validation on the server; the client never supplies results. */
export async function recordListingValidation(input: unknown, expectedOrganizationId: string | null) {
  const {listingId, provider} = validateInput(recordListingValidationSchema, input);
  const context = await adminContext(expectedOrganizationId);
  const {result} = await loadExport(context, listingId, provider);
  const errors = result.issues.filter(issue => issue.severity === "ERROR");
  const summary = errors.map(issue => issue.code).join(", ").slice(0, 2000) || null;
  await executeWorkspaceOperation(() => sql.recordListingValidation(context.request.dc, {
    organizationId: context.organizationId, listingId, provider: sql.PortalProvider[provider],
    status: result.ready ? sql.ListingPublicationState.READY : sql.ListingPublicationState.VALIDATION_FAILED,
    errorCount: errors.length, warningCount: result.issues.length - errors.length, payloadHash: result.payloadHash, errorSummary: summary,
  }, context.request.options), "RecordListingValidation");
  return {ready: result.ready, errorCount: errors.length, warningCount: result.issues.length - errors.length};
}

/**
 * Validates and serializes ACTIVE listings in memory, then records only the
 * counts. No feed file is stored and no public URL is created.
 */
export async function runFeedDryRun(input: unknown, expectedOrganizationId: string | null) {
  const {provider, format} = validateInput(feedDryRunSchema, input);
  const {request, organizationId} = await adminContext(expectedOrganizationId);
  const startedAt = new Date().toISOString();
  const rows: Awaited<ReturnType<typeof sql.listPortalExportListings>>["data"]["listings"] = [];
  let mappings: Awaited<ReturnType<typeof sql.listPortalExportListings>>["data"]["mappings"] = [];
  let total = 0;
  for (let offset = 0; offset < FEED_DRY_RUN_LIMIT; offset += FEED_PAGE_SIZE) {
    const page = await executeWorkspaceOperation(() => sql.listPortalExportListings(request.dc, {organizationId, limit: FEED_PAGE_SIZE, offset}, request.options), "ListPortalExportListings");
    rows.push(...page.listings); mappings = page.mappings; total = page.total[0]?._count ?? 0;
    if (page.listings.length < FEED_PAGE_SIZE) break;
  }
  const result = buildFeedDryRun(provider, format, rows, mappings, new Date());
  await executeWorkspaceOperation(() => sql.recordFeedGenerationJob(request.dc, {
    organizationId, provider: sql.PortalProvider[provider], format: sql.FeedFormat[format], status: sql.FeedGenerationStatus.SUCCEEDED,
    listingCount: result.listingCount, validCount: result.validCount, invalidCount: result.invalidCount, byteSize: result.byteSize,
    errorSummary: result.errorSummary, startedAt,
  }, request.options), "RecordFeedGenerationJob");
  return {...result, activeListingTotal: total, truncated: total > rows.length};
}
