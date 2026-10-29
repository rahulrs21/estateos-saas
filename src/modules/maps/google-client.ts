import { emirateFromText, isWithinUae, roundCoordinate, UAE_BOUNDS, type Emirate } from "./geo";

/**
 * Google Maps Platform web-service client. The API key is passed in by the
 * server wrapper and is only ever sent to Google in a request header or query;
 * it never appears in returned values or thrown messages.
 *
 * - Places API (New) Autocomplete and Place Details: https://developers.google.com/maps/documentation/places/web-service
 * - Geocoding API: https://developers.google.com/maps/documentation/geocoding
 */

export type NormalizedPlace = {
  placeId: string | null;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  emirate: Emirate | null;
  city: string | null;
  community: string | null;
  area: string | null;
  countryCode: string | null;
  withinUae: boolean;
  /** Location fields Google did not return; the form asks the user to complete them. */
  missingFields: Array<"emirate" | "city" | "community" | "address">;
};

export type PlaceSuggestion = {placeId: string; primaryText: string; secondaryText: string | null};

/**
 * NOT_FOUND: no such place. INVALID_REQUEST: Google rejected the input.
 * REJECTED: authentication or configuration (invalid key, API not enabled,
 * key restrictions, billing). QUOTA: rate or daily quota exhausted.
 * UNAVAILABLE: network failure, timeout or a provider outage.
 * `providerStatus` is Google's status code for server logs; it never contains the key.
 */
export type MapsProviderErrorReason = "NOT_FOUND" | "INVALID_REQUEST" | "REJECTED" | "QUOTA" | "UNAVAILABLE";

export class MapsProviderError extends Error {
  constructor(public readonly reason: MapsProviderErrorReason, message: string, public readonly providerStatus: string | null = null) {
    super(message);
    this.name = "MapsProviderError";
  }
}

const providerMessages: Record<MapsProviderErrorReason, string> = {
  NOT_FOUND: "That place could not be found.",
  INVALID_REQUEST: "The map service could not process this search. Check the address and try again.",
  REJECTED: "Address lookup is not available because the Google Maps server key was rejected. Ask an administrator to check the key and enabled APIs.",
  QUOTA: "The address lookup quota has been reached. Try again later or enter the location manually.",
  UNAVAILABLE: "The map service is temporarily unavailable. Try again shortly.",
};

/** Classify a Places API (New) HTTP failure from its status code and google.rpc status. */
export function classifyPlacesFailure(httpStatus: number, rpcStatus: string | null): MapsProviderErrorReason {
  if (httpStatus === 404 || rpcStatus === "NOT_FOUND") return "NOT_FOUND";
  if (httpStatus === 429 || rpcStatus === "RESOURCE_EXHAUSTED") return "QUOTA";
  if (httpStatus === 401 || httpStatus === 403 || rpcStatus === "PERMISSION_DENIED" || rpcStatus === "UNAUTHENTICATED") return "REJECTED";
  if (httpStatus === 400 && rpcStatus === "FAILED_PRECONDITION") return "REJECTED";
  if (httpStatus === 400) return "INVALID_REQUEST";
  return "UNAVAILABLE";
}

/** Classify a Geocoding API (and Maps JavaScript Geocoder) status. */
export function classifyGeocodeStatus(status: string | undefined): MapsProviderErrorReason | "OK" | "ZERO_RESULTS" {
  switch (status) {
    case "OK": return "OK";
    case "ZERO_RESULTS": return "ZERO_RESULTS";
    case "REQUEST_DENIED": return "REJECTED";
    case "OVER_QUERY_LIMIT": case "OVER_DAILY_LIMIT": return "QUOTA";
    case "INVALID_REQUEST": return "INVALID_REQUEST";
    default: return "UNAVAILABLE";
  }
}

export function mapsProviderError(reason: MapsProviderErrorReason, providerStatus: string | null = null) {
  return new MapsProviderError(reason, providerMessages[reason], providerStatus);
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
export type GoogleMapsClientOptions = {apiKey: string; fetch?: FetchLike; timeoutMs?: number; languageCode?: string};

type Component = {names: string[]; types: string[]};

function pick(components: Component[], ...types: string[]) {
  for (const type of types) {
    const match = components.find(component => component.types.includes(type));
    if (match?.names[0]) return match.names[0];
  }
  return null;
}

/** Translate Google address components into EstateOS location fields. */
export function normalizeAddressComponents(input: {
  placeId?: string | null; formattedAddress?: string | null; latitude: number; longitude: number; components: Component[];
}): NormalizedPlace {
  const {components} = input;
  const countryCode = components.find(component => component.types.includes("country"))?.names.at(-1)?.toUpperCase() ?? null;
  const emirate = emirateFromText(pick(components, "administrative_area_level_1"));
  const city = pick(components, "locality", "postal_town", "administrative_area_level_2");
  // UAE addresses usually expose the master community as sublocality_level_1
  // and a sub-community or district as neighborhood.
  const community = pick(components, "sublocality_level_1", "sublocality", "neighborhood");
  const area = pick(components, "neighborhood", "sublocality_level_2", "premise");
  const latitude = roundCoordinate(input.latitude);
  const longitude = roundCoordinate(input.longitude);
  return {
    placeId: input.placeId ?? null,
    formattedAddress: input.formattedAddress?.slice(0, 1000) ?? null,
    latitude, longitude,
    emirate,
    city: city?.slice(0, 120) ?? null,
    community: community?.slice(0, 160) ?? null,
    area: area && area !== community ? area.slice(0, 160) : null,
    countryCode,
    withinUae: countryCode === "AE" && isWithinUae(latitude, longitude),
    missingFields: ([["emirate", emirate], ["city", city], ["community", community], ["address", input.formattedAddress]] as const)
      .filter(([, value]) => !value).map(([field]) => field),
  };
}

export function createGoogleMapsClient({apiKey, fetch: fetchImpl = fetch, timeoutMs = 8000, languageCode = "en"}: GoogleMapsClientOptions) {
  if (!apiKey) throw new Error("A Google Maps server key is required.");

  async function request(url: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetchImpl(url, {...init, cache: "no-store", signal: AbortSignal.timeout(timeoutMs)});
    } catch (error) {
      throw mapsProviderError("UNAVAILABLE", error instanceof Error && error.name === "TimeoutError" ? "TIMEOUT" : "NETWORK");
    }
    if (!response.ok) {
      let rpcStatus: string | null = null;
      try { rpcStatus = ((await response.json()) as {error?: {status?: unknown}}).error?.status as string ?? null; } catch { /* Non-JSON error body. */ }
      if (typeof rpcStatus !== "string" || !/^[A-Z_]{1,40}$/.test(rpcStatus)) rpcStatus = null;
      throw mapsProviderError(classifyPlacesFailure(response.status, rpcStatus), rpcStatus ?? `HTTP_${response.status}`);
    }
    try { return await response.json() as unknown; }
    catch { throw mapsProviderError("UNAVAILABLE", "UNREADABLE_RESPONSE"); }
  }

  const placesHeaders = (fieldMask: string) => ({"Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": fieldMask});

  type NewComponent = {longText?: string; shortText?: string; types?: string[]};
  const fromNewComponents = (components: NewComponent[] | undefined): Component[] => (components ?? []).map(component => ({
    names: [component.longText, component.shortText].filter((value): value is string => Boolean(value)), types: component.types ?? [],
  }));

  type LegacyResult = {place_id?: string; formatted_address?: string; geometry?: {location?: {lat?: number; lng?: number}}; address_components?: Array<{long_name?: string; short_name?: string; types?: string[]}>};
  function fromGeocodeResponse(body: unknown): NormalizedPlace[] {
    const data = body as {status?: string; results?: LegacyResult[]};
    const status = classifyGeocodeStatus(data.status);
    if (status === "ZERO_RESULTS") return [];
    if (status !== "OK") throw mapsProviderError(status, typeof data.status === "string" ? data.status.slice(0, 40) : null);
    return (data.results ?? []).flatMap(result => {
      const lat = result.geometry?.location?.lat; const lng = result.geometry?.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") return [];
      return [normalizeAddressComponents({
        placeId: result.place_id ?? null, formattedAddress: result.formatted_address ?? null, latitude: lat, longitude: lng,
        components: (result.address_components ?? []).map(component => ({
          names: [component.long_name, component.short_name].filter((value): value is string => Boolean(value)), types: component.types ?? [],
        })),
      })];
    });
  }

  return {
    async autocomplete(input: string, sessionToken: string): Promise<PlaceSuggestion[]> {
      const body = await request("https://places.googleapis.com/v1/places:autocomplete", {
        method: "POST",
        headers: placesHeaders("suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat"),
        body: JSON.stringify({
          input, sessionToken, languageCode, includedRegionCodes: ["ae"],
          locationRestriction: {rectangle: {low: {latitude: UAE_BOUNDS.south, longitude: UAE_BOUNDS.west}, high: {latitude: UAE_BOUNDS.north, longitude: UAE_BOUNDS.east}}},
        }),
      }) as {suggestions?: Array<{placePrediction?: {placeId?: string; text?: {text?: string}; structuredFormat?: {mainText?: {text?: string}; secondaryText?: {text?: string}}}}>};
      return (body.suggestions ?? []).flatMap(({placePrediction: prediction}) => {
        if (!prediction?.placeId) return [];
        const primaryText = prediction.structuredFormat?.mainText?.text ?? prediction.text?.text;
        if (!primaryText) return [];
        return [{placeId: prediction.placeId, primaryText, secondaryText: prediction.structuredFormat?.secondaryText?.text ?? null}];
      }).slice(0, 8);
    },

    async placeDetails(placeId: string, sessionToken: string | null): Promise<NormalizedPlace> {
      const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
      url.searchParams.set("languageCode", languageCode);
      url.searchParams.set("regionCode", "ae");
      if (sessionToken) url.searchParams.set("sessionToken", sessionToken);
      const body = await request(url.toString(), {method: "GET", headers: placesHeaders("id,formattedAddress,location,addressComponents")}) as {
        id?: string; formattedAddress?: string; location?: {latitude?: number; longitude?: number}; addressComponents?: NewComponent[];
      };
      if (typeof body.location?.latitude !== "number" || typeof body.location?.longitude !== "number") {
        throw new MapsProviderError("NOT_FOUND", "That place has no map location.", "NO_LOCATION");
      }
      return normalizeAddressComponents({
        placeId: body.id ?? placeId, formattedAddress: body.formattedAddress ?? null,
        latitude: body.location.latitude, longitude: body.location.longitude, components: fromNewComponents(body.addressComponents),
      });
    },

    async geocodeAddress(address: string): Promise<NormalizedPlace[]> {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", address);
      url.searchParams.set("components", "country:AE");
      url.searchParams.set("region", "ae");
      url.searchParams.set("language", languageCode);
      url.searchParams.set("key", apiKey);
      return fromGeocodeResponse(await request(url.toString())).slice(0, 5);
    },

    async reverseGeocode(latitude: number, longitude: number): Promise<NormalizedPlace[]> {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("latlng", `${latitude},${longitude}`);
      url.searchParams.set("language", languageCode);
      url.searchParams.set("key", apiKey);
      // Keep the caller's pin: reverse geocoding describes the point, it does not move it.
      return fromGeocodeResponse(await request(url.toString())).slice(0, 1).map(place => ({
        ...place, latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude),
        withinUae: place.countryCode === "AE" && isWithinUae(latitude, longitude),
      }));
    },
  };
}

export type GoogleMapsClient = ReturnType<typeof createGoogleMapsClient>;
