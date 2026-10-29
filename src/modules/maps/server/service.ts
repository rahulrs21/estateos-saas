import "server-only";

import { WorkspaceError } from "@/modules/organizations/server/errors";
import { assertOrganizationAdministrator } from "@/modules/organizations/server/permission-policy";
import { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { assertExpectedOrganization } from "@/modules/leads/server/request-policy";
import { parseInventory } from "@/modules/inventory/validation";
import { createGoogleMapsClient, MapsProviderError, type GoogleMapsClient } from "../google-client";
import { mapLookupOperationSchema, mapLookupSchemas, type MapLookupOperation } from "../validation";
import { enforceRateLimit } from "@/lib/rate-limit/server";
import { mapLookupRateLimitChecks } from "../rate-limits";

let cachedClient: {key: string; client: GoogleMapsClient} | null = null;

/** The server key is read only here and is never returned to callers. */
function mapsClient() {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!key) throw new WorkspaceError("MAPS_NOT_CONFIGURED", 503, "Address lookup is not configured for this environment. Enter the location manually.");
  if (cachedClient?.key !== key) cachedClient = {key, client: createGoogleMapsClient({apiKey: key})};
  return cachedClient.client;
}

function providerError(error: unknown, operation: MapLookupOperation): never {
  if (error instanceof MapsProviderError) {
    // Server-side signal for misconfiguration and quota problems. The key is
    // never part of a MapsProviderError, and no address text is logged.
    if (error.reason !== "NOT_FOUND") console.warn(JSON.stringify({event: "maps.provider_error", operation, reason: error.reason, providerStatus: error.providerStatus}));
    switch (error.reason) {
      case "NOT_FOUND": throw new WorkspaceError("NOT_FOUND", 404, error.message);
      case "INVALID_REQUEST": throw new WorkspaceError("VALIDATION_ERROR", 400, error.message);
      case "QUOTA": throw new WorkspaceError("MAPS_QUOTA_EXCEEDED", 429, error.message, 60);
      case "REJECTED": throw new WorkspaceError("MAPS_PROVIDER_REJECTED", 503, error.message);
      case "UNAVAILABLE": throw new WorkspaceError("MAPS_UNAVAILABLE", 503, error.message, 10);
    }
  }
  throw error;
}

/**
 * Address lookups are limited to company administrators because only they can
 * edit project and property locations. No tenant data is sent to Google: only
 * the typed address, a selected place ID, or a pin position.
 */
export async function performMapLookup(operationName: string, input: unknown, expectedOrganizationId: string | null, clientIp: string | null = null) {
  const operation = parseInventory(mapLookupOperationSchema, operationName);
  const context = await requireActiveOrganizationRequest();
  assertExpectedOrganization(expectedOrganizationId, context.organizationId);
  assertOrganizationAdministrator(context.membership);
  const client = mapsClient();
  await enforceRateLimit(mapLookupRateLimitChecks(operation, {
    membershipId: context.membership.id, organizationId: context.organizationId, clientIp,
  }), "Too many address lookups. Wait a moment and try again.");
  try {
    switch (operation) {
      case "autocomplete": {
        const data = parseInventory(mapLookupSchemas.autocomplete, input);
        return {suggestions: await client.autocomplete(data.input, data.sessionToken)};
      }
      case "place": {
        const data = parseInventory(mapLookupSchemas.place, input);
        return {place: await client.placeDetails(data.placeId, data.sessionToken ?? null)};
      }
      case "geocode": {
        const data = parseInventory(mapLookupSchemas.geocode, input);
        return {places: await client.geocodeAddress(data.address)};
      }
      case "reverse-geocode": {
        const data = parseInventory(mapLookupSchemas["reverse-geocode"], input);
        return {place: (await client.reverseGeocode(data.latitude, data.longitude))[0] ?? null};
      }
    }
  } catch (error) { providerError(error, operation); }
}
