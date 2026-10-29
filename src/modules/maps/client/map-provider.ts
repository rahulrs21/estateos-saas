/**
 * Which map renderer to use. NEXT_PUBLIC_MAP_PROVIDER:
 * - auto (default): Google Maps when a browser key is configured, otherwise
 *   OpenStreetMap tiles through Leaflet (no key or billing).
 * - google: Google only; without a key, maps show their not-configured state.
 * - osm: always OpenStreetMap.
 * - none: no third-party map tiles at all (text locations only).
 * Address search is separate and always needs a Google key.
 */
export type MapProviderSetting = "auto" | "google" | "osm" | "none";
export type MapProvider = "google" | "osm" | "none";

export function parseMapProviderSetting(value: string | undefined): MapProviderSetting {
  const normalized = value?.trim().toLowerCase();
  return normalized === "google" || normalized === "osm" || normalized === "none" ? normalized : "auto";
}

export function resolveMapProvider(setting: MapProviderSetting, hasGoogleKey: boolean): MapProvider {
  if (setting === "none") return "none";
  if (setting === "osm") return "osm";
  if (setting === "google") return hasGoogleKey ? "google" : "none";
  return hasGoogleKey ? "google" : "osm";
}

/** After Google fails to load or rejects its key, "auto" falls back to OpenStreetMap. */
export function fallbackProvider(setting: MapProviderSetting): MapProvider {
  return setting === "auto" ? "osm" : "none";
}

export const mapProviderSetting = parseMapProviderSetting(process.env.NEXT_PUBLIC_MAP_PROVIDER);
