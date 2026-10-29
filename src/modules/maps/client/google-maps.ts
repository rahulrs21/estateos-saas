"use client";

/**
 * Minimal loader and typings for the Google Maps JavaScript API, used only to
 * draw maps. Address search and geocoding go through /api/maps with the
 * server-only key. The browser key is public by design and must be restricted
 * to the app's HTTP referrers and the Maps JavaScript API (see docs/MAPS.md).
 */

export type LatLngLiteral = {lat: number; lng: number};
type MapsEventListener = {remove(): void};
type LatLng = {lat(): number; lng(): number};
type MapMouseEvent = {latLng: LatLng | null};

export interface GoogleMap {
  setCenter(center: LatLngLiteral): void;
  setZoom(zoom: number): void;
  getZoom(): number | undefined;
  fitBounds(bounds: LatLngBounds, padding?: number): void;
  panTo(center: LatLngLiteral): void;
  getBounds(): LatLngBounds | undefined;
  addListener(event: "click", handler: (event: MapMouseEvent) => void): MapsEventListener;
  addListener(event: "idle", handler: () => void): MapsEventListener;
}
export interface LatLngBounds {
  extend(point: LatLngLiteral): LatLngBounds; isEmpty(): boolean;
  getNorthEast(): LatLng; getSouthWest(): LatLng;
}
export interface AdvancedMarker {
  map: GoogleMap | null;
  position: LatLngLiteral | LatLng | null;
  gmpDraggable: boolean;
  title: string;
  zIndex: number | null;
  content?: Node | null;
  addListener(event: "click" | "dragend" | "gmp-click", handler: () => void): MapsEventListener;
}
export interface PinElement { element: HTMLElement }
export interface MapCircle { setMap(map: GoogleMap | null): void; setOptions(options: Record<string, unknown>): void; addListener(event: "click", handler: () => void): MapsEventListener }

export type GoogleMapsApi = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Circle: new (options: Record<string, unknown>) => MapCircle;
  LatLngBounds: new () => LatLngBounds;
  AdvancedMarkerElement: new (options: Record<string, unknown>) => AdvancedMarker;
  PinElement: new (options: Record<string, unknown>) => PinElement;
};

type ImportLibrary = (name: string) => Promise<Record<string, unknown>>;
declare global {
  interface Window {
    google?: {maps?: {importLibrary?: ImportLibrary}}; __estateosMapsReady?: () => void;
    /** Called by the Maps JavaScript API when the browser key is rejected. */
    gm_authFailure?: () => void;
  }
}

export const browserMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim() ?? "";
/**
 * Advanced markers require a map ID. DEMO_MAP_ID is Google's development
 * placeholder; configure a real map ID from Google Cloud for hosted use.
 */
export const browserMapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID";
export const isBrowserMapConfigured = Boolean(browserMapsKey);

let loading: Promise<GoogleMapsApi> | null = null;
let authFailed = false;
const authFailureListeners = new Set<() => void>();

/**
 * Google reports an invalid, unauthorized or referrer-blocked browser key by
 * calling window.gm_authFailure after the script has loaded; the map then
 * shows Google's own error overlay. Components subscribe to replace it with an
 * explanatory state.
 */
export function onMapsAuthFailure(listener: () => void) {
  if (authFailed) listener();
  authFailureListeners.add(listener);
  return () => { authFailureListeners.delete(listener); };
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (!browserMapsKey) return Promise.reject(new Error("MAPS_BROWSER_KEY_MISSING"));
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    if (window.google?.maps?.importLibrary) { resolve(); return; }
    const script = document.createElement("script");
    const params = new URLSearchParams({key: browserMapsKey, v: "weekly", loading: "async", callback: "__estateosMapsReady", region: "AE", language: "en"});
    script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
    script.async = true;
    window.__estateosMapsReady = () => resolve();
    window.gm_authFailure = () => { authFailed = true; for (const listener of authFailureListeners) listener(); };
    script.onerror = () => reject(new Error("MAPS_SCRIPT_FAILED"));
    document.head.append(script);
  }).then(async () => {
    const importLibrary = window.google!.maps!.importLibrary!;
    const [maps, core, marker] = await Promise.all([importLibrary("maps"), importLibrary("core"), importLibrary("marker")]);
    return {
      Map: maps.Map, Circle: maps.Circle, LatLngBounds: core.LatLngBounds,
      AdvancedMarkerElement: marker.AdvancedMarkerElement, PinElement: marker.PinElement,
    } as GoogleMapsApi;
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export function readPosition(position: AdvancedMarker["position"]): LatLngLiteral | null {
  if (!position) return null;
  return typeof (position as LatLng).lat === "function"
    ? {lat: (position as LatLng).lat(), lng: (position as LatLng).lng()}
    : position as LatLngLiteral;
}
