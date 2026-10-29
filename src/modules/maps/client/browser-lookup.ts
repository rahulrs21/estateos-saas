"use client";

import { isWithinUae, roundCoordinate, UAE_BOUNDS } from "../geo";
import {
  classifyGeocodeStatus, mapsProviderError, normalizeAddressComponents, type MapsProviderErrorReason,
  type NormalizedPlace, type PlaceSuggestion,
} from "../google-client";
import { loadGoogleMaps } from "./google-maps";

/**
 * Address lookup through the Maps JavaScript API with the public browser key.
 * Used only when GOOGLE_MAPS_SERVER_KEY is not configured: the browser key must
 * then also allow Places API (New) and Geocoding API, and Google's quotas are
 * the only limit (the server rate limiter is not involved). Results go through
 * the same normalization as server lookups.
 *
 * https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
 * https://developers.google.com/maps/documentation/javascript/geocoding
 */

type LatLng = {lat(): number; lng(): number};
type Text = {text?: string} | null | undefined;
type Prediction = {placeId?: string; text?: Text; mainText?: Text; secondaryText?: Text; toPlace(): Place};
type Place = {
  id?: string; formattedAddress?: string | null; location?: LatLng | null;
  addressComponents?: Array<{longText?: string | null; shortText?: string | null; types?: string[]}> | null;
  fetchFields(options: {fields: string[]}): Promise<unknown>;
};
type PlacesLibrary = {
  AutocompleteSuggestion: {fetchAutocompleteSuggestions(request: Record<string, unknown>): Promise<{suggestions: Array<{placePrediction?: Prediction | null}>}>};
  AutocompleteSessionToken: new () => object;
  Place: new (options: {id: string}) => Place;
};
type GeocoderResult = {place_id?: string; formatted_address?: string; geometry?: {location?: LatLng}; address_components?: Array<{long_name?: string; short_name?: string; types?: string[]}>};
type GeocodingLibrary = {Geocoder: new () => {geocode(request: Record<string, unknown>): Promise<{results: GeocoderResult[]}>}};

const sessions = new Map<string, object>();
const predictions = new Map<string, Prediction>();

async function libraries() {
  await loadGoogleMaps();
  const importLibrary = window.google!.maps!.importLibrary!;
  const [places, geocoding] = await Promise.all([importLibrary("places"), importLibrary("geocoding")]);
  return {places: places as unknown as PlacesLibrary, geocoding: geocoding as unknown as GeocodingLibrary};
}

/** Classify Maps JavaScript API failures (MapsRequestError / MapsServerError) by their code or message. */
export function classifyBrowserMapsError(error: unknown): MapsProviderErrorReason {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as {code: unknown}).code) : "";
  const fromStatus = classifyGeocodeStatus(code);
  if (fromStatus === "ZERO_RESULTS") return "NOT_FOUND";
  if (fromStatus !== "UNAVAILABLE" && fromStatus !== "OK") return fromStatus;
  const message = error instanceof Error ? error.message : "";
  if (/RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota/i.test(`${code} ${message}`)) return "QUOTA";
  if (/PERMISSION_DENIED|UNAUTHENTICATED|REQUEST_DENIED|API key|not authorized|ApiNotActivated|Billing/i.test(`${code} ${message}`)) return "REJECTED";
  if (/INVALID_ARGUMENT|INVALID_REQUEST/i.test(`${code} ${message}`)) return "INVALID_REQUEST";
  return "UNAVAILABLE";
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (error) { throw mapsProviderError(classifyBrowserMapsError(error)); }
}

function fromPlace(place: Place, placeId: string): NormalizedPlace {
  const location = place.location;
  if (!location) throw mapsProviderError("NOT_FOUND", "NO_LOCATION");
  return normalizeAddressComponents({
    placeId: place.id ?? placeId, formattedAddress: place.formattedAddress ?? null, latitude: location.lat(), longitude: location.lng(),
    components: (place.addressComponents ?? []).map(component => ({
      names: [component.longText, component.shortText].filter((value): value is string => Boolean(value)), types: component.types ?? [],
    })),
  });
}

function fromGeocoder(results: GeocoderResult[]) {
  return results.flatMap(result => {
    const location = result.geometry?.location;
    if (!location) return [];
    return [normalizeAddressComponents({
      placeId: result.place_id ?? null, formattedAddress: result.formatted_address ?? null, latitude: location.lat(), longitude: location.lng(),
      components: (result.address_components ?? []).map(component => ({
        names: [component.long_name, component.short_name].filter((value): value is string => Boolean(value)), types: component.types ?? [],
      })),
    })];
  });
}

export const browserLookup = {
  autocomplete: (input: string, sessionToken: string) => guarded(async () => {
    const {places} = await libraries();
    if (!sessions.has(sessionToken)) { sessions.clear(); sessions.set(sessionToken, new places.AutocompleteSessionToken()); }
    const {suggestions} = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input, sessionToken: sessions.get(sessionToken), includedRegionCodes: ["ae"], language: "en", region: "ae",
      locationRestriction: {south: UAE_BOUNDS.south, west: UAE_BOUNDS.west, north: UAE_BOUNDS.north, east: UAE_BOUNDS.east},
    });
    predictions.clear();
    return {suggestions: suggestions.flatMap(({placePrediction: prediction}): PlaceSuggestion[] => {
      const primaryText = prediction?.mainText?.text ?? prediction?.text?.text;
      if (!prediction?.placeId || !primaryText) return [];
      predictions.set(prediction.placeId, prediction);
      return [{placeId: prediction.placeId, primaryText, secondaryText: prediction.secondaryText?.text ?? null}];
    }).slice(0, 8)};
  }),
  place: (placeId: string, sessionToken: string | null) => guarded(async () => {
    const {places} = await libraries();
    // toPlace() keeps the autocomplete session, so the search and details are billed as one session.
    const place = predictions.get(placeId)?.toPlace() ?? new places.Place({id: placeId});
    await place.fetchFields({fields: ["id", "formattedAddress", "location", "addressComponents"]});
    if (sessionToken) sessions.delete(sessionToken);
    return {place: fromPlace(place, placeId)};
  }),
  geocode: (address: string) => guarded(async () => {
    const {geocoding} = await libraries();
    try {
      const {results} = await new geocoding.Geocoder().geocode({address, componentRestrictions: {country: "AE"}, region: "ae", language: "en"});
      return {places: fromGeocoder(results).slice(0, 5)};
    } catch (error) {
      if (classifyBrowserMapsError(error) === "NOT_FOUND") return {places: []};
      throw error;
    }
  }),
  reverseGeocode: (latitude: number, longitude: number) => guarded(async () => {
    const {geocoding} = await libraries();
    try {
      const {results} = await new geocoding.Geocoder().geocode({location: {lat: latitude, lng: longitude}, language: "en"});
      const place = fromGeocoder(results)[0];
      return {place: place ? {...place, latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude), withinUae: place.countryCode === "AE" && isWithinUae(latitude, longitude)} : null};
    } catch (error) {
      if (classifyBrowserMapsError(error) === "NOT_FOUND") return {place: null};
      throw error;
    }
  }),
};
