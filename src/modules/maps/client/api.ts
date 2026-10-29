"use client";

import { MapsProviderError, type NormalizedPlace, type PlaceSuggestion } from "../google-client";
import { browserLookup } from "./browser-lookup";
import { isBrowserMapConfigured } from "./google-maps";
import type { MapBounds } from "../geo";

export class MapLookupError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "MapLookupError"; }
}

async function serverLookup<T>(operation: string, body: unknown, organizationId: string): Promise<T> {
  const securityResponse = await fetch("/api/auth/csrf", {credentials: "same-origin", cache: "no-store"});
  const security = await securityResponse.json().catch(() => ({})) as {csrfToken?: string; error?: {message?: string}};
  if (!securityResponse.ok || !security.csrfToken) throw new MapLookupError("CSRF", security.error?.message || "Could not prepare a secure request. Reload and try again.");
  const response = await fetch(`/api/maps/${operation}`, {
    method: "POST", credentials: "same-origin", cache: "no-store",
    headers: {"Content-Type": "application/json", "X-CSRF-Token": security.csrfToken, "X-EstateOS-Organization": organizationId},
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({})) as {data?: T; error?: {code?: string; message?: string}};
  if (!response.ok || result.data === undefined) {
    const retry = response.headers.get("Retry-After");
    const message = result.error?.message || "Address lookup failed. Try again.";
    throw new MapLookupError(result.error?.code ?? `HTTP_${response.status}`, retry && response.status === 429 ? `${message} (retry in ${retry}s)` : message);
  }
  return result.data;
}

// Set once the server reports that it has no server key; later lookups in this
// page session go straight to the browser-key provider.
let useBrowserProvider = false;

/**
 * Address lookups run on the server with the server-only key by default. When
 * the server has no key (MAPS_NOT_CONFIGURED) and a browser key exists, the
 * Maps JavaScript API is used instead; see browser-lookup.ts.
 */
async function lookup<T>(operation: string, body: unknown, organizationId: string, browser: () => Promise<T>): Promise<T> {
  if (useBrowserProvider) return browserCall(browser);
  try { return await serverLookup<T>(operation, body, organizationId); }
  catch (error) {
    if (!(error instanceof MapLookupError) || error.code !== "MAPS_NOT_CONFIGURED" || !isBrowserMapConfigured) throw error;
    useBrowserProvider = true;
    return browserCall(browser);
  }
}

async function browserCall<T>(work: () => Promise<T>) {
  try { return await work(); }
  catch (error) { throw new MapLookupError(error instanceof MapsProviderError ? `MAPS_${error.reason}` : "MAPS_UNAVAILABLE", error instanceof Error ? error.message : "Address lookup failed."); }
}

export const mapLookup = {
  autocomplete: (organizationId: string, input: string, sessionToken: string) =>
    lookup<{suggestions: PlaceSuggestion[]}>("autocomplete", {input, sessionToken}, organizationId, () => browserLookup.autocomplete(input, sessionToken)),
  place: (organizationId: string, placeId: string, sessionToken: string | null) =>
    lookup<{place: NormalizedPlace}>("place", {placeId, sessionToken}, organizationId, () => browserLookup.place(placeId, sessionToken)),
  geocode: (organizationId: string, address: string) =>
    lookup<{places: NormalizedPlace[]}>("geocode", {address}, organizationId, () => browserLookup.geocode(address)),
  reverseGeocode: (organizationId: string, latitude: number, longitude: number) =>
    lookup<{place: NormalizedPlace | null}>("reverse-geocode", {latitude, longitude}, organizationId, () => browserLookup.reverseGeocode(latitude, longitude)),
};

export type MapPinPage<T> = {
  total: number; mapped: number; mappedAll: number; limit: number; offset: number; hasMore: boolean;
  bounds: MapBounds | null; pins: T[];
};

/** One page of server-filtered, already-sanitized pins for the visible area. */
export async function fetchMapPins<T>(resource: "properties" | "listings", query: Record<string, string>, bounds: MapBounds | null, offset: number, signal?: AbortSignal) {
  const params = new URLSearchParams({...query, resource});
  if (bounds) for (const key of ["south", "west", "north", "east"] as const) params.set(key, bounds[key].toFixed(6));
  if (offset) params.set("offset", String(offset));
  const response = await fetch(`/api/maps/pins?${params}`, {credentials: "same-origin", cache: "no-store", signal});
  const result = await response.json().catch(() => ({})) as {data?: MapPinPage<T>; error?: {message?: string}};
  if (!response.ok || !result.data) throw new Error(result.error?.message || "Map results could not be loaded. Try again.");
  return result.data;
}
