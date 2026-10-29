import assert from "node:assert/strict";
import { test } from "node:test";
import {
  approximateCoordinates, describeLocation, emirateFromText, exactGoogleMapsUrl, googleMapsUrl, isWithinUae,
  presentMapLocation, redactStoredLocation, snapBoundsToGrid, withoutRawLocation, APPROXIMATE_GRID_DEGREES,
} from "../src/modules/maps/geo";
import {
  classifyGeocodeStatus, classifyPlacesFailure, createGoogleMapsClient, MapsProviderError, normalizeAddressComponents,
} from "../src/modules/maps/google-client";
import { classifyBrowserMapsError } from "../src/modules/maps/client/browser-lookup";
import { mapLookupSchemas, mapPinPageSchema, mapViewportSchema } from "../src/modules/maps/validation";
import { mapLookupRateLimitChecks, mapRateLimitRules } from "../src/modules/maps/rate-limits";
import { fallbackProvider, parseMapProviderSetting, resolveMapProvider } from "../src/modules/maps/client/map-provider";
import { buildListingListOperationInput, buildingInputSchema, developerInputSchema, projectInputSchema, propertyInputSchema } from "../src/modules/inventory/validation";

const id = "10000000-0000-4000-8000-000000000001";
const marina = {latitude: 25.080512, longitude: 55.140231};
const baseProperty = {propertyReference: "MAP-1", propertyType: "APARTMENT", areaUnit: "SQFT", occupancyStatus: "VACANT", inventoryStatus: "AVAILABLE"};
const baseProject = {developerId: id, projectName: "Map project", projectCode: "MAP-P", projectType: "RESIDENTIAL", currency: "AED"};

test("UAE bounds accept emirate locations and reject swapped or foreign coordinates", () => {
  for (const [lat, lng] of [[25.2048, 55.2708], [24.4539, 54.3773], [25.3463, 55.4209], [25.1288, 56.3265], [25.7895, 55.9432]]) {
    assert.equal(isWithinUae(lat, lng), true, `${lat},${lng}`);
  }
  assert.equal(isWithinUae(55.2708, 25.2048), false, "swapped coordinates");
  assert.equal(isWithinUae(51.5072, -0.1276), false, "London");
  assert.equal(isWithinUae(Number.NaN, 55), false);
});

test("Google administrative areas map to the Emirate enum, including spelling variants", () => {
  assert.equal(emirateFromText("Dubai"), "DUBAI");
  assert.equal(emirateFromText("Abu Dhabi"), "ABU_DHABI");
  assert.equal(emirateFromText("Emirate of Abu Dhabi"), "ABU_DHABI");
  assert.equal(emirateFromText("Ras al-Khaimah"), "RAS_AL_KHAIMAH");
  assert.equal(emirateFromText("Umm Al-Quwain"), "UMM_AL_QUWAIN");
  assert.equal(emirateFromText("Al Fujairah"), "FUJAIRAH");
  assert.equal(emirateFromText("Sharjah Emirate"), "SHARJAH");
  assert.equal(emirateFromText("Muscat"), null);
  assert.equal(emirateFromText(null), null);
});

test("approximate coordinates snap to a fixed grid cell and cannot be averaged back to the exact point", () => {
  const a = approximateCoordinates(marina.latitude, marina.longitude);
  const b = approximateCoordinates(marina.latitude + 0.002, marina.longitude + 0.003);
  assert.deepEqual(a, b, "points in the same cell share one approximate location");
  assert.notEqual(a.latitude, marina.latitude);
  assert.ok(Math.abs(a.latitude - marina.latitude) <= APPROXIMATE_GRID_DEGREES);
  assert.ok(Math.abs(a.longitude - marina.longitude) <= APPROXIMATE_GRID_DEGREES);
  assert.deepEqual(approximateCoordinates(marina.latitude, marina.longitude), a, "deterministic");
});

test("map display mode controls exact, approximate and hidden presentation", () => {
  const exact = presentMapLocation({...marina, googlePlaceId: "ChIJ_place_123", mapDisplayMode: "EXACT"}, {revealExact: false});
  assert.equal(exact.display.precision, "EXACT");
  assert.equal(exact.display.latitude, marina.latitude);
  assert.equal(exact.display.placeId, "ChIJ_place_123");
  assert.equal(exact.exact, null, "non-administrators never receive the separate exact block");

  const approximate = presentMapLocation({...marina, googlePlaceId: "ChIJ_place_123", mapDisplayMode: "APPROXIMATE"}, {revealExact: false});
  assert.equal(approximate.display.precision, "APPROXIMATE");
  assert.notEqual(approximate.display.latitude, marina.latitude);
  assert.equal(approximate.display.placeId, null, "a place ID would reveal the exact place");
  assert.ok((approximate.display.radiusMeters ?? 0) > 0);
  assert.equal(approximate.exact, null);
  assert.ok(!JSON.stringify(approximate).includes(String(marina.latitude)), "serialized payload omits the exact latitude");

  const hidden = presentMapLocation({...marina, mapDisplayMode: "HIDDEN"}, {revealExact: false});
  assert.equal(hidden.display.precision, "NONE");
  assert.equal(hidden.display.latitude, null);
  assert.equal(hidden.display.longitude, null);
  assert.ok(!JSON.stringify(hidden).includes(String(marina.longitude)));

  const adminView = presentMapLocation({...marina, mapDisplayMode: "HIDDEN"}, {revealExact: true});
  assert.equal(adminView.display.precision, "NONE", "display still follows the mode for administrators");
  assert.deepEqual(adminView.exact, {...marina, placeId: null});
});

test("unknown modes and incomplete coordinates never produce a point", () => {
  assert.equal(presentMapLocation({...marina, mapDisplayMode: "PUBLIC"}, {revealExact: false}).display.precision, "NONE");
  assert.equal(presentMapLocation({...marina, mapDisplayMode: null}, {revealExact: false}).display.precision, "NONE");
  assert.equal(presentMapLocation({latitude: 25.1, longitude: null, mapDisplayMode: "EXACT"}, {revealExact: true}).exact, null);
});

test("API reads by non-administrators keep the record shape but follow the display mode", () => {
  const stored = {id, ...marina, googlePlaceId: "ChIJ_place_123"};
  assert.deepEqual(redactStoredLocation(stored, "EXACT"), stored);
  const approximate = redactStoredLocation(stored, "APPROXIMATE");
  assert.deepEqual({latitude: approximate.latitude, longitude: approximate.longitude}, approximateCoordinates(marina.latitude, marina.longitude));
  assert.equal(approximate.googlePlaceId, null);
  assert.deepEqual(
    presentMapLocation({...approximate, mapDisplayMode: "APPROXIMATE"}, {revealExact: false}).display,
    presentMapLocation({...stored, mapDisplayMode: "APPROXIMATE"}, {revealExact: false}).display,
    "presenting an already redacted record gives the same approximate area",
  );
  for (const mode of ["HIDDEN", "UNKNOWN", null]) {
    const hidden = redactStoredLocation(stored, mode);
    assert.equal(hidden.latitude, null);
    assert.equal(hidden.longitude, null);
    assert.equal(hidden.googlePlaceId, null);
    assert.equal(hidden.id, id);
  }
});

test("raw location fields are stripped before serialization", () => {
  const stripped = withoutRawLocation({id, community: "Dubai Marina", ...marina, googlePlaceId: "ChIJ_place_123"});
  assert.deepEqual(stripped, {id, community: "Dubai Marina"});
});

test("Google Maps links respect the display precision", () => {
  const exact = presentMapLocation({...marina, googlePlaceId: "ChIJ_place_123", mapDisplayMode: "EXACT"}, {revealExact: true});
  const exactUrl = new URL(googleMapsUrl(exact.display)!);
  assert.equal(exactUrl.origin + exactUrl.pathname, "https://www.google.com/maps/search/");
  assert.equal(exactUrl.searchParams.get("query"), `${marina.latitude},${marina.longitude}`);
  assert.equal(exactUrl.searchParams.get("query_place_id"), "ChIJ_place_123");

  const approximate = presentMapLocation({...marina, googlePlaceId: "ChIJ_place_123", mapDisplayMode: "APPROXIMATE"}, {revealExact: true});
  const approximateUrl = new URL(googleMapsUrl(approximate.display)!);
  assert.equal(approximateUrl.searchParams.get("query_place_id"), null);
  assert.notEqual(approximateUrl.searchParams.get("query"), `${marina.latitude},${marina.longitude}`);
  assert.ok(exactGoogleMapsUrl(approximate.exact)!.includes(String(marina.latitude)), "administrators get a separate exact link");

  const hidden = presentMapLocation({...marina, mapDisplayMode: "HIDDEN"}, {revealExact: false});
  assert.equal(googleMapsUrl(hidden.display), null);
  const fallback = new URL(googleMapsUrl(hidden.display, describeLocation({community: "Dubai Marina", emirate: "DUBAI"}))!);
  assert.equal(fallback.searchParams.get("query"), "Dubai Marina, Dubai, United Arab Emirates");
});

test("property locations default to approximate display and must be inside the UAE", () => {
  const parsed = propertyInputSchema.parse({...baseProperty, ...marina, city: "Dubai", googlePlaceId: "ChIJ_place_123"});
  assert.equal(parsed.mapDisplayMode, "APPROXIMATE");
  assert.equal(parsed.city, "Dubai");
  assert.equal(propertyInputSchema.parse({...baseProperty}).mapDisplayMode, "APPROXIMATE", "records without coordinates remain valid");
  assert.equal(propertyInputSchema.safeParse({...baseProperty, latitude: marina.longitude, longitude: marina.latitude}).success, false, "swapped");
  assert.equal(propertyInputSchema.safeParse({...baseProperty, latitude: 51.5, longitude: -0.12}).success, false, "outside UAE");
  assert.equal(propertyInputSchema.safeParse({...baseProperty, ...marina, mapDisplayMode: "PUBLIC"}).success, false);
  for (const googlePlaceId of ["../../etc", "has space", "x"]) {
    assert.equal(propertyInputSchema.safeParse({...baseProperty, ...marina, googlePlaceId}).success, false, googlePlaceId);
  }
  const outside = propertyInputSchema.safeParse({...baseProperty, latitude: 51.5, longitude: -0.12});
  assert.equal(outside.success ? "" : outside.error.issues[0].path[0], "latitude", "the error is attached to a visible field");
});

test("project coordinates are paired, and UAE projects must be inside the UAE", () => {
  assert.equal(projectInputSchema.parse({...baseProject, ...marina}).mapDisplayMode, "EXACT");
  assert.equal(projectInputSchema.safeParse({...baseProject, latitude: 25.1}).success, false, "one coordinate");
  assert.equal(projectInputSchema.safeParse({...baseProject, latitude: 51.5, longitude: -0.12}).success, false, "AE project abroad");
  assert.equal(projectInputSchema.safeParse({...baseProject, country: "GB", latitude: 51.5, longitude: -0.12}).success, true, "non-UAE project");
  assert.equal(projectInputSchema.safeParse({...baseProject, ...marina, mapDisplayMode: "HIDDEN", organizationId: id}).success, false, "tenant authority is still rejected");
  assert.equal(buildingInputSchema.safeParse({projectId: id, name: "Tower A", buildingType: "RESIDENTIAL", longitude: 55.1}).success, false);
});

test("map lookup inputs are bounded before any provider call", () => {
  assert.equal(mapLookupSchemas.autocomplete.safeParse({input: "D", sessionToken: "0f8c1a3e-1111-4222-8333-444455556666"}).success, false);
  assert.equal(mapLookupSchemas.autocomplete.safeParse({input: "Dubai Marina", sessionToken: "0f8c1a3e-1111-4222-8333-444455556666"}).success, true);
  assert.equal(mapLookupSchemas.autocomplete.safeParse({input: "Dubai Marina", sessionToken: "bad token"}).success, false);
  assert.equal(mapLookupSchemas.place.safeParse({placeId: "../admin"}).success, false);
  assert.equal(mapLookupSchemas["reverse-geocode"].safeParse({latitude: 51.5, longitude: -0.12}).success, false);
  assert.equal(mapLookupSchemas["reverse-geocode"].safeParse(marina).success, true);
  assert.equal(mapLookupSchemas.geocode.safeParse({address: "Dubai", organizationId: id}).success, false, "strict input");
});

test("listing filters translate prices to minor units and keep location filters", () => {
  assert.deepEqual(buildListingListOperationInput({emirate: "DUBAI", community: "Dubai Marina", propertyType: "VILLA", minimumPrice: "1000000.5", maximumPrice: "2000000", page: 2}), {
    search: undefined, listingStatus: undefined, purpose: undefined, marketType: undefined, emirate: "DUBAI", community: "Dubai Marina",
    propertyType: "VILLA", minimumPriceMinor: "100000050", maximumPriceMinor: "200000000", sort: undefined, limit: 25, offset: 25,
  });
});

const placeComponents = [
  {names: ["Marina Gate 1"], types: ["premise"]}, {names: ["Dubai Marina", "Dubai Marina"], types: ["neighborhood", "political"]},
  {names: ["Marsa Dubai"], types: ["sublocality_level_1", "sublocality", "political"]}, {names: ["Dubai"], types: ["locality", "political"]},
  {names: ["Dubai"], types: ["administrative_area_level_1", "political"]}, {names: ["United Arab Emirates", "AE"], types: ["country", "political"]},
];

test("Google address components normalize into EstateOS location fields", () => {
  const place = normalizeAddressComponents({placeId: "ChIJ_place_123", formattedAddress: "Marina Gate 1 - Dubai Marina - Dubai", latitude: 25.0805123456, longitude: 55.1402314567, components: placeComponents});
  assert.equal(place.emirate, "DUBAI");
  assert.equal(place.city, "Dubai");
  assert.equal(place.community, "Marsa Dubai");
  assert.equal(place.area, "Dubai Marina");
  assert.equal(place.countryCode, "AE");
  assert.equal(place.latitude, 25.080512, "rounded to the stored numeric(9,6) precision");
  assert.equal(place.withinUae, true);
  const foreign = normalizeAddressComponents({latitude: 51.5, longitude: -0.12, components: [{names: ["United Kingdom", "GB"], types: ["country"]}]});
  assert.equal(foreign.withinUae, false);
});

type Call = {url: string; init?: RequestInit};
function mockFetch(responses: Array<{status?: number; body: unknown} | Error>) {
  const calls: Call[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push({url, init});
    const next = responses.shift();
    if (!next) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next.body), {status: next.status ?? 200, headers: {"Content-Type": "application/json"}});
  };
  return {calls, fetchImpl};
}
const apiKey = "test-server-key-not-real";

test("Places autocomplete is restricted to the UAE and keeps the key in a header", async () => {
  const {calls, fetchImpl} = mockFetch([{body: {suggestions: [
    {placePrediction: {placeId: "ChIJ_place_123", text: {text: "Marina Gate 1, Dubai"}, structuredFormat: {mainText: {text: "Marina Gate 1"}, secondaryText: {text: "Dubai Marina, Dubai"}}}},
    {queryPrediction: {text: {text: "marina"}}},
  ]}}]);
  const client = createGoogleMapsClient({apiKey, fetch: fetchImpl});
  const suggestions = await client.autocomplete("Marina Gate", "0f8c1a3e-1111-4222-8333-444455556666");
  assert.deepEqual(suggestions, [{placeId: "ChIJ_place_123", primaryText: "Marina Gate 1", secondaryText: "Dubai Marina, Dubai"}]);
  const body = JSON.parse(String(calls[0].init?.body));
  assert.deepEqual(body.includedRegionCodes, ["ae"]);
  assert.ok(body.locationRestriction.rectangle);
  assert.equal(new Headers(calls[0].init?.headers).get("X-Goog-Api-Key"), apiKey);
  assert.ok(!calls[0].url.includes(apiKey));
  assert.ok(!JSON.stringify(suggestions).includes(apiKey));
});

test("place details and geocoding normalize results; reverse geocoding keeps the chosen pin", async () => {
  const {calls, fetchImpl} = mockFetch([
    {body: {id: "ChIJ_place_123", formattedAddress: "Marina Gate 1 - Dubai", location: {latitude: 25.0805, longitude: 55.1402},
      addressComponents: placeComponents.map(({names, types}) => ({longText: names[0], shortText: names[1] ?? names[0], types}))}},
    {body: {status: "ZERO_RESULTS", results: []}},
    {body: {status: "OK", results: [{place_id: "ChIJ_nearby", formatted_address: "Nearby", geometry: {location: {lat: 25.081, lng: 55.141}},
      address_components: [{long_name: "Dubai", short_name: "Dubai", types: ["administrative_area_level_1"]}, {long_name: "United Arab Emirates", short_name: "AE", types: ["country"]}]}]}},
  ]);
  const client = createGoogleMapsClient({apiKey, fetch: fetchImpl});
  const place = await client.placeDetails("ChIJ_place_123", null);
  assert.equal(place.emirate, "DUBAI");
  assert.equal(place.placeId, "ChIJ_place_123");
  assert.match(calls[0].url, /^https:\/\/places\.googleapis\.com\/v1\/places\/ChIJ_place_123\?/);
  assert.deepEqual(await client.geocodeAddress("Nowhere"), []);
  assert.equal(new URL(calls[1].url).searchParams.get("components"), "country:AE");
  const [reverse] = await client.reverseGeocode(marina.latitude, marina.longitude);
  assert.equal(reverse.latitude, marina.latitude);
  assert.equal(reverse.longitude, marina.longitude);
  assert.equal(reverse.emirate, "DUBAI");
});

test("provider failures become safe errors that never include the key", async () => {
  const cases: Array<[{status?: number; body: unknown} | Error, string]> = [
    [{body: {status: "REQUEST_DENIED", error_message: `The provided API key ${apiKey} is invalid.`}}, "REJECTED"],
    [{status: 403, body: {error: {message: apiKey}}}, "REJECTED"],
    [{status: 500, body: {}}, "UNAVAILABLE"],
    [new Error(`connect ECONNREFUSED ${apiKey}`), "UNAVAILABLE"],
  ];
  for (const [response, reason] of cases) {
    const {fetchImpl} = mockFetch([response]);
    const client = createGoogleMapsClient({apiKey, fetch: fetchImpl});
    await assert.rejects(client.geocodeAddress("Dubai Marina"), (error: unknown) => {
      assert.ok(error instanceof MapsProviderError);
      assert.equal(error.reason, reason);
      assert.ok(!error.message.includes(apiKey));
      return true;
    });
  }
});

test("Google authentication, quota and invalid-request failures are classified separately", async () => {
  const cases: Array<[{status?: number; body: unknown} | Error, string, string | null]> = [
    [{status: 403, body: {error: {status: "PERMISSION_DENIED", message: `API key not valid: ${apiKey}`}}}, "REJECTED", "PERMISSION_DENIED"],
    [{status: 400, body: {error: {status: "FAILED_PRECONDITION", message: "Billing is not enabled"}}}, "REJECTED", "FAILED_PRECONDITION"],
    [{status: 429, body: {error: {status: "RESOURCE_EXHAUSTED"}}}, "QUOTA", "RESOURCE_EXHAUSTED"],
    [{status: 400, body: {error: {status: "INVALID_ARGUMENT"}}}, "INVALID_REQUEST", "INVALID_ARGUMENT"],
    [{status: 503, body: "not json"}, "UNAVAILABLE", "HTTP_503"],
  ];
  for (const [response, reason, providerStatus] of cases) {
    const {fetchImpl} = mockFetch([response]);
    const client = createGoogleMapsClient({apiKey, fetch: fetchImpl});
    await assert.rejects(client.autocomplete("Dubai Marina", "0123456789abcdef0123"), (error: unknown) => {
      assert.ok(error instanceof MapsProviderError);
      assert.equal(error.reason, reason);
      assert.equal(error.providerStatus, providerStatus);
      assert.ok(!error.message.includes(apiKey) && !String(error.providerStatus).includes(apiKey));
      return true;
    });
  }
  for (const [status, reason] of [["OVER_QUERY_LIMIT", "QUOTA"], ["OVER_DAILY_LIMIT", "QUOTA"], ["INVALID_REQUEST", "INVALID_REQUEST"], ["UNKNOWN_ERROR", "UNAVAILABLE"]] as const) {
    const {fetchImpl} = mockFetch([{body: {status}}]);
    await assert.rejects(createGoogleMapsClient({apiKey, fetch: fetchImpl}).geocodeAddress("Dubai"), (error: unknown) => error instanceof MapsProviderError && error.reason === reason);
  }
  assert.equal(classifyPlacesFailure(401, null), "REJECTED");
  assert.equal(classifyPlacesFailure(404, null), "NOT_FOUND");
  assert.equal(classifyGeocodeStatus("ZERO_RESULTS"), "ZERO_RESULTS");
});

test("browser-key lookup errors are classified like server errors", () => {
  assert.equal(classifyBrowserMapsError(Object.assign(new Error("x"), {code: "REQUEST_DENIED"})), "REJECTED");
  assert.equal(classifyBrowserMapsError(Object.assign(new Error("x"), {code: "OVER_QUERY_LIMIT"})), "QUOTA");
  assert.equal(classifyBrowserMapsError(Object.assign(new Error("x"), {code: "ZERO_RESULTS"})), "NOT_FOUND");
  assert.equal(classifyBrowserMapsError(new Error("PERMISSION_DENIED: Places API (New) has not been used in project")), "REJECTED");
  assert.equal(classifyBrowserMapsError(new Error("RESOURCE_EXHAUSTED")), "QUOTA");
  assert.equal(classifyBrowserMapsError(new Error("network down")), "UNAVAILABLE");
});

test("incomplete Google locations list the fields the user must complete", () => {
  const partial = normalizeAddressComponents({placeId: "ChIJ_partial", formattedAddress: null, ...marina, components: [
    {names: ["United Arab Emirates", "AE"], types: ["country"]}, {names: ["Dubai"], types: ["administrative_area_level_1"]},
  ]});
  assert.deepEqual(partial.missingFields, ["city", "community", "address"]);
  assert.equal(partial.emirate, "DUBAI");
});

test("viewport bounds snap outward to whole approximate cells", () => {
  const snapped = snapBoundsToGrid({south: 25.0712, west: 55.1323, north: 25.0899, east: 55.1501});
  assert.deepEqual(snapped, {south: 25.07, west: 55.13, north: 25.09, east: 55.16});
  assert.deepEqual(snapBoundsToGrid(snapped), snapped, "already-aligned bounds are unchanged");
  // Bounds that touch an approximate point's cell include the whole cell, so
  // moving the bounds within a cell cannot reveal the exact point.
  const point = {latitude: 25.073456, longitude: 55.137891};
  const cell = approximateCoordinates(point.latitude, point.longitude);
  for (const [south, north] of [[25.0735, 25.2], [25.0, 25.0734], [25.071, 25.072], [25.0745, 25.3]]) {
    const area = snapBoundsToGrid({south, north, west: 55.0, east: 55.2});
    const includesExact = point.latitude >= area.south && point.latitude <= area.north;
    const includesCell = cell.latitude >= area.south && cell.latitude <= area.north;
    assert.equal(includesExact, includesCell, `${south}–${north}`);
  }
  assert.deepEqual(snapBoundsToGrid({south: -89.999, west: -179.999, north: 89.999, east: 179.999}), {south: -90, west: -180, north: 90, east: 180});
});

test("viewport and paging inputs are validated", () => {
  assert.deepEqual(mapViewportSchema.parse({south: "25.01", north: "25.2", west: "55", east: "55.4"}), {south: 25.01, north: 25.2, west: 55, east: 55.4});
  for (const invalid of [{south: 25.2, north: 25.1, west: 55, east: 55.4}, {south: 25, north: 26, west: 55.5, east: 55.4},
    {south: "1e2", north: 26, west: 55, east: 56}, {south: 25, north: 91, west: 55, east: 56}, {south: 25, north: 26, west: 55}]) {
    assert.equal(mapViewportSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
  }
  assert.equal(mapPinPageSchema.parse("500"), 500);
  assert.equal(mapPinPageSchema.safeParse("20001").success, false);
  assert.equal(mapPinPageSchema.safeParse("-1").success, false);
});

test("developer head-office coordinates are paired and UAE-checked only for UAE developers", () => {
  const base = {name: "Head Office Co", slug: "head-office-co", country: "AE"};
  assert.equal(developerInputSchema.safeParse({...base, headOfficeLatitude: 25.195, headOfficeLongitude: 55.279, headOfficeGooglePlaceId: "ChIJ_head_office"}).success, true);
  assert.equal(developerInputSchema.safeParse({...base, headOfficeLatitude: 25.195}).success, false);
  assert.equal(developerInputSchema.safeParse({...base, headOfficeLatitude: 51.5072, headOfficeLongitude: -0.1276}).success, false);
  assert.equal(developerInputSchema.safeParse({...base, country: "GB", headOfficeLatitude: 51.5072, headOfficeLongitude: -0.1276}).success, true);
  assert.equal(developerInputSchema.safeParse({...base, headOfficeGooglePlaceId: "bad id!"}).success, false);
});

test("map lookup rate limits separate autocomplete from geocoding and cover member, IP and company", () => {
  const subjects = {membershipId: "m-1", organizationId: "o-1", clientIp: "203.0.113.9"};
  const autocomplete = mapLookupRateLimitChecks("autocomplete", subjects);
  const geocode = mapLookupRateLimitChecks("reverse-geocode", subjects);
  assert.deepEqual(autocomplete.map(check => check.rule.scope), ["maps.autocomplete.member", "maps.autocomplete.ip", "maps.autocomplete.company"]);
  assert.deepEqual(geocode.map(check => check.rule.scope), ["maps.geocode.member", "maps.geocode.ip", "maps.geocode.company"]);
  assert.deepEqual(mapLookupRateLimitChecks("place", subjects).map(check => check.rule.scope), geocode.map(check => check.rule.scope), "place details share the geocoding budget");
  assert.deepEqual(autocomplete.map(check => check.subject), ["m-1", "203.0.113.9", "o-1"]);
  assert.equal(mapLookupRateLimitChecks("geocode", {...subjects, clientIp: null})[1].subject, "", "unknown IPs are skipped, not pooled");
  assert.ok(mapRateLimitRules.autocompleteMember.limit > mapRateLimitRules.geocodeMember.limit);
});

test("maps use Google with a key, OpenStreetMap without one, and can be turned off", () => {
  assert.equal(parseMapProviderSetting(undefined), "auto");
  assert.equal(parseMapProviderSetting(" OSM "), "osm");
  assert.equal(parseMapProviderSetting("bing"), "auto");
  assert.equal(resolveMapProvider("auto", true), "google");
  assert.equal(resolveMapProvider("auto", false), "osm");
  assert.equal(resolveMapProvider("google", false), "none");
  assert.equal(resolveMapProvider("osm", true), "osm");
  assert.equal(resolveMapProvider("none", true), "none");
  assert.equal(fallbackProvider("auto"), "osm", "a rejected Google key falls back to OpenStreetMap");
  assert.equal(fallbackProvider("google"), "none");
});
