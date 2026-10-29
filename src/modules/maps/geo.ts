/**
 * Pure location rules shared by the server and the browser. Nothing here reads
 * secrets or performs I/O, so the same rules run in tests, server views and
 * client-side form validation.
 */

export const mapDisplayModes = ["EXACT", "APPROXIMATE", "HIDDEN"] as const;
export type MapDisplayMode = (typeof mapDisplayModes)[number];

export const emirates = ["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"] as const;
export type Emirate = (typeof emirates)[number];

export const emirateLabels: Record<Emirate, string> = {
  ABU_DHABI: "Abu Dhabi", DUBAI: "Dubai", SHARJAH: "Sharjah", AJMAN: "Ajman",
  UMM_AL_QUWAIN: "Umm Al Quwain", RAS_AL_KHAIMAH: "Ras Al Khaimah", FUJAIRAH: "Fujairah",
};

export const mapDisplayModeLabels: Record<MapDisplayMode, {label: string; description: string}> = {
  EXACT: {label: "Exact pin", description: "Show the exact stored point."},
  APPROXIMATE: {label: "Approximate area", description: "Show only a ~1 km area around the location."},
  HIDDEN: {label: "Hidden", description: "Do not show the location on maps or map links."},
};

/**
 * A deliberately generous bounding box around the UAE mainland and islands. It
 * is a sanity check that catches swapped or mistyped coordinates, not a legal
 * boundary; reverse geocoding remains the source for emirate and address data.
 */
export const UAE_BOUNDS = {south: 22.4, west: 51.0, north: 26.5, east: 56.6} as const;
export const UAE_CENTER = {latitude: 24.4, longitude: 54.4} as const;

export function isWithinUae(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= UAE_BOUNDS.south && latitude <= UAE_BOUNDS.north
    && longitude >= UAE_BOUNDS.west && longitude <= UAE_BOUNDS.east;
}

/** Stored coordinates use numeric(9,6); round inputs to the same precision. */
export function roundCoordinate(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

const emirateAliases: Array<[RegExp, Emirate]> = [
  [/abu ?dhabi/, "ABU_DHABI"], [/dubai/, "DUBAI"], [/sharjah|shariqah/, "SHARJAH"], [/ajman/, "AJMAN"],
  [/umm ?al ?qu?w(?:ain|ayn)/, "UMM_AL_QUWAIN"], [/ras ?al ?khaim(?:ah|a)/, "RAS_AL_KHAIMAH"], [/fujairah|fujayrah/, "FUJAIRAH"],
];

/** Map Google's administrative area names (with spelling variants) to the Emirate enum. */
export function emirateFromText(value: string | null | undefined): Emirate | null {
  if (!value) return null;
  const normalized = value.toLowerCase().normalize("NFKD").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim()
    .replace(/^(?:emirate of|al) /, "");
  for (const [pattern, emirate] of emirateAliases) if (pattern.test(normalized)) return emirate;
  return null;
}

/** Size of the approximate grid. 0.01° is roughly 1.1 km north–south in the UAE. */
export const APPROXIMATE_GRID_DEGREES = 0.01;
export const APPROXIMATE_RADIUS_METERS = 800;

/**
 * Snap a point to the centre of its grid cell. The result depends only on the
 * cell, so repeated requests cannot be averaged to recover the exact point.
 */
export function approximateCoordinates(latitude: number, longitude: number) {
  const snap = (value: number) => roundCoordinate((Math.floor(value / APPROXIMATE_GRID_DEGREES) + 0.5) * APPROXIMATE_GRID_DEGREES);
  return {latitude: snap(latitude), longitude: snap(longitude)};
}

export type StoredLocation = {
  latitude?: number | null; longitude?: number | null;
  googlePlaceId?: string | null; mapDisplayMode?: string | null;
};

export type MapPrecision = "EXACT" | "APPROXIMATE" | "NONE";

/** The only location shape that may be sent to a browser for display. */
export type DisplayLocation = {
  mode: MapDisplayMode;
  precision: MapPrecision;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  placeId: string | null;
};

export type PresentedLocation = {
  display: DisplayLocation;
  /** Exact stored values, present only for viewers allowed to edit the record. */
  exact: {latitude: number; longitude: number; placeId: string | null} | null;
};

export function parseMapDisplayMode(value: string | null | undefined, fallback: MapDisplayMode): MapDisplayMode {
  return (mapDisplayModes as readonly string[]).includes(value ?? "") ? value as MapDisplayMode : fallback;
}

/**
 * Apply a record's map display mode. Display coordinates follow the mode for
 * every viewer; `revealExact` additionally returns the stored point for
 * administrators who can already edit it. A missing or unknown mode is treated
 * as HIDDEN so an unexpected value can never leak a point.
 */
export function presentMapLocation(stored: StoredLocation, {revealExact}: {revealExact: boolean}): PresentedLocation {
  const mode = parseMapDisplayMode(stored.mapDisplayMode, "HIDDEN");
  const hasPoint = stored.latitude != null && stored.longitude != null && Number.isFinite(stored.latitude) && Number.isFinite(stored.longitude);
  const exact = hasPoint && revealExact
    ? {latitude: stored.latitude!, longitude: stored.longitude!, placeId: stored.googlePlaceId ?? null}
    : null;
  const none: DisplayLocation = {mode, precision: "NONE", latitude: null, longitude: null, radiusMeters: null, placeId: null};
  if (!hasPoint || mode === "HIDDEN") return {display: none, exact};
  if (mode === "APPROXIMATE") {
    const point = approximateCoordinates(stored.latitude!, stored.longitude!);
    return {display: {mode, precision: "APPROXIMATE", ...point, radiusMeters: APPROXIMATE_RADIUS_METERS, placeId: null}, exact};
  }
  return {
    display: {mode, precision: "EXACT", latitude: stored.latitude!, longitude: stored.longitude!, radiusMeters: null, placeId: stored.googlePlaceId ?? null},
    exact,
  };
}

/**
 * Apply a display mode to a stored record while keeping its shape, for API
 * reads by viewers who cannot edit it: EXACT is unchanged, APPROXIMATE is
 * snapped to its grid cell without a place ID, anything else loses its point.
 * Snapping is idempotent, so presentMapLocation can run on the result again.
 */
export function redactStoredLocation<T extends StoredLocation>(record: T, mode: string | null | undefined): T {
  const parsed = parseMapDisplayMode(mode, "HIDDEN");
  if (parsed === "EXACT") return record;
  if (parsed === "APPROXIMATE" && record.latitude != null && record.longitude != null) {
    return {...record, ...approximateCoordinates(record.latitude, record.longitude), googlePlaceId: record.googlePlaceId === undefined ? undefined : null};
  }
  return {...record, latitude: record.latitude === undefined ? undefined : null, longitude: record.longitude === undefined ? undefined : null,
    googlePlaceId: record.googlePlaceId === undefined ? undefined : null};
}

/** Remove raw coordinates and place IDs from a record before it is serialized to a browser. */
export function withoutRawLocation<T extends object>(record: T): Omit<T, "latitude" | "longitude" | "googlePlaceId"> {
  const copy: Record<string, unknown> = {...record as Record<string, unknown>};
  delete copy.latitude; delete copy.longitude; delete copy.googlePlaceId;
  return copy as Omit<T, "latitude" | "longitude" | "googlePlaceId">;
}

export function describeLocation(parts: {community?: string | null; area?: string | null; city?: string | null; emirate?: string | null}) {
  const emirate = parts.emirate && parts.emirate in emirateLabels ? emirateLabels[parts.emirate as Emirate] : null;
  const values = [parts.community, parts.area, parts.city, emirate].filter((value): value is string => Boolean(value?.trim()));
  return [...new Set(values)].join(", ");
}

/**
 * Build a Google Maps URL (https://developers.google.com/maps/documentation/urls)
 * for the display location. Approximate links point at the coarse cell; hidden
 * locations fall back to a text search of the visible community/emirate only.
 */
export function googleMapsUrl(display: DisplayLocation, fallbackQuery?: string | null, region: string | null = "United Arab Emirates"): string | null {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  if (display.precision !== "NONE" && display.latitude != null && display.longitude != null) {
    url.searchParams.set("query", `${display.latitude},${display.longitude}`);
    if (display.precision === "EXACT" && display.placeId) url.searchParams.set("query_place_id", display.placeId);
    return url.toString();
  }
  if (!fallbackQuery?.trim()) return null;
  url.searchParams.set("query", region ? `${fallbackQuery.trim()}, ${region}` : fallbackQuery.trim());
  return url.toString();
}

export function exactGoogleMapsUrl(exact: PresentedLocation["exact"]): string | null {
  if (!exact) return null;
  return googleMapsUrl({mode: "EXACT", precision: "EXACT", latitude: exact.latitude, longitude: exact.longitude, radiusMeters: null, placeId: exact.placeId});
}

export type MapBounds = {south: number; west: number; north: number; east: number};

/**
 * Expand requested map bounds outward to whole approximate-grid cells. A pin
 * filter on stored coordinates then includes an APPROXIMATE record exactly
 * when its published grid cell is inside the area, so shrinking the bounds
 * cannot reveal more about its position than the cell already does.
 */
export function snapBoundsToGrid(bounds: MapBounds): MapBounds {
  const step = APPROXIMATE_GRID_DEGREES;
  // Round before floor/ceil so values already on a cell edge stay put.
  const cells = (value: number) => Math.round(value / step * 1e6) / 1e6;
  return {
    south: Math.max(-90, roundCoordinate(Math.floor(cells(bounds.south)) * step)),
    west: Math.max(-180, roundCoordinate(Math.floor(cells(bounds.west)) * step)),
    north: Math.min(90, roundCoordinate(Math.ceil(cells(bounds.north)) * step)),
    east: Math.min(180, roundCoordinate(Math.ceil(cells(bounds.east)) * step)),
  };
}
