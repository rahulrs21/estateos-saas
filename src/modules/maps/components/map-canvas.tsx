"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, MapPinOff } from "lucide-react";
import { UAE_CENTER, type MapBounds } from "../geo";
import { LeafletCanvas } from "./leaflet-canvas";
import { fallbackProvider, mapProviderSetting, resolveMapProvider } from "../client/map-provider";
import {
  browserMapId, isBrowserMapConfigured, loadGoogleMaps, onMapsAuthFailure, readPosition,
  type AdvancedMarker, type GoogleMap, type GoogleMapsApi, type MapCircle,
} from "../client/google-maps";

export type MapCanvasMarker = {
  id: string; latitude: number; longitude: number; title: string;
  precision: "EXACT" | "APPROXIMATE"; radiusMeters?: number | null; variant?: "primary" | "secondary";
};

const colors = {primary: "#2563eb", secondary: "#64748b", selected: "#d97706"};
type Drawn = {marker: MapCanvasMarker; pin: AdvancedMarker | null; circle: MapCircle | null; restyle(selected: boolean): void};
type Clusterer = {addMarkers(markers: AdvancedMarker[]): void; clearMarkers(): void; setMap(map: GoogleMap | null): void};

/** Round dot used for approximate locations when markers are clustered. */
function areaDot(selected: boolean) {
  const dot = document.createElement("div");
  dot.style.cssText = `width:18px;height:18px;border-radius:9999px;border:2px solid #fff;box-shadow:0 0 0 2px ${selected ? colors.selected : colors.primary};background:${selected ? colors.selected : colors.primary}66`;
  return dot;
}

function clusterBadge(count: number) {
  const badge = document.createElement("div");
  const size = count < 10 ? 32 : count < 100 ? 38 : count < 1000 ? 44 : 50;
  badge.style.cssText = `width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${colors.primary};color:#fff;font:600 12px/1 system-ui,sans-serif;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)`;
  badge.textContent = count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k` : String(count);
  return badge;
}

export type MapCanvasProps = {
  markers: MapCanvasMarker[]; selectedId?: string | null; onSelect?: (id: string) => void;
  /** Makes the first marker draggable and lets a map click move it. */
  onPositionChange?: (latitude: number, longitude: number) => void;
  /** Called (debounced) with the visible bounds after the user pans or zooms. */
  onViewportChange?: (bounds: MapBounds) => void;
  /** Group nearby markers into clusters that show counts and zoom in on click. */
  cluster?: boolean;
  /** "markers" re-fits whenever the set of locations changes; "initial" fits once and then leaves the viewport to the user. */
  fit?: "markers" | "initial";
  label: string; className?: string; unavailable?: ReactNode;
};

/**
 * Map that draws exact points as pins and approximate locations as circles (or,
 * when clustered, as area dots that open a circle on selection). Google Maps is
 * used when a browser key is configured; otherwise OpenStreetMap through
 * Leaflet (see client/map-provider.ts). It is a visual aid only: callers render
 * an accessible list or text alongside it, and the page stays usable without a map.
 */
export function MapCanvas(props: MapCanvasProps) {
  const [googleFailed, setGoogleFailed] = useState(false);
  const provider = googleFailed ? fallbackProvider(mapProviderSetting) : resolveMapProvider(mapProviderSetting, isBrowserMapConfigured);
  if (provider === "google") return <GoogleMapCanvas {...props} onFailure={() => setGoogleFailed(true)} />;
  if (provider === "osm") return <LeafletCanvas {...props} />;
  return <MapUnavailable className={props.className ?? "h-80"} failed={googleFailed} unavailable={props.unavailable} />;
}

function MapUnavailable({className, failed, unavailable}: {className: string; failed: boolean; unavailable?: ReactNode}) {
  return <div className={`${className} flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-6 text-center`} role="status" data-map-state={failed ? "failed" : "unconfigured"}>
    <MapPinOff className="size-6 text-muted-foreground" aria-hidden="true" />
    <p className="text-sm font-medium">{failed ? "The map could not be loaded" : "Map preview is not configured"}</p>
    <p className="max-w-sm text-xs leading-5 text-muted-foreground">{failed
      ? "Google Maps failed to load or rejected the browser key. Check NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY (Maps JavaScript API enabled, this site's address allowed, billing active), then reload."
      : unavailable ?? "Maps are turned off for this environment. Location details remain available as text."}</p>
  </div>;
}

function GoogleMapCanvas({markers, selectedId, onSelect, onPositionChange, onViewportChange, cluster = false, fit = "markers", label, className = "h-80", onFailure}: MapCanvasProps & {onFailure: () => void}) {
  const container = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<GoogleMapsApi | null>(null);
  const [map, setMap] = useState<GoogleMap | null>(null);
  const [failure, setFailure] = useState<"" | "load" | "auth">("");
  const callbacks = useRef({onSelect, onPositionChange, onViewportChange});
  useEffect(() => { callbacks.current = {onSelect, onPositionChange, onViewportChange}; }, [onSelect, onPositionChange, onViewportChange]);
  const drawn = useRef(new Map<string, Drawn>());
  const fitted = useRef(false);
  const clusterer = useRef<Clusterer | null>(null);
  const editable = Boolean(onPositionChange);
  const watchViewport = Boolean(onViewportChange);

  useEffect(() => {
    if (!isBrowserMapConfigured) return;
    let active = true;
    const unsubscribe = onMapsAuthFailure(() => { if (active) setFailure("auth"); });
    loadGoogleMaps().then(loaded => { if (active) setApi(loaded); }).catch(() => { if (active) setFailure("load"); });
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!api || !container.current || map) return;
    const created = new api.Map(container.current, {
      center: {lat: UAE_CENTER.latitude, lng: UAE_CENTER.longitude}, zoom: 7, mapId: browserMapId,
      gestureHandling: "cooperative", clickableIcons: false, streetViewControl: false, mapTypeControl: false, fullscreenControl: true,
    });
    setMap(created);
  }, [api, map]);

  useEffect(() => {
    if (!map || !editable) return;
    const listener = map.addListener("click", event => {
      if (event.latLng) callbacks.current.onPositionChange?.(event.latLng.lat(), event.latLng.lng());
    });
    return () => listener.remove();
  }, [map, editable]);

  // Report the viewport after the user stops moving the map. The first idle
  // after load or a programmatic fit describes the data's own extent, which the
  // caller already has, so it is skipped.
  useEffect(() => {
    if (!map || !watchViewport) return;
    let timer: number | undefined;
    let first = true;
    const listener = map.addListener("idle", () => {
      if (first) { first = false; return; }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const bounds = map.getBounds();
        if (!bounds) return;
        const north = bounds.getNorthEast(), south = bounds.getSouthWest();
        if (south.lng() > north.lng()) return; // Antimeridian views are out of scope for UAE inventory.
        callbacks.current.onViewportChange?.({south: south.lat(), west: south.lng(), north: north.lat(), east: north.lng()});
      }, 400);
    });
    return () => { listener.remove(); window.clearTimeout(timer); };
  }, [map, watchViewport]);

  // Rebuild markers only when the set of locations changes; selection changes restyle in place.
  const markerKey = markers.map(marker => `${marker.id}:${marker.latitude}:${marker.longitude}:${marker.precision}`).join("|");
  useEffect(() => {
    if (!api || !map) return;
    const created = new Map<string, Drawn>();
    markers.forEach((marker, index) => {
      const position = {lat: marker.latitude, lng: marker.longitude};
      const baseColor = colors[marker.variant ?? "primary"];
      if (marker.precision === "APPROXIMATE" && !cluster) {
        const circle = new api.Circle({
          map, center: position, radius: marker.radiusMeters ?? 800, clickable: Boolean(callbacks.current.onSelect),
          strokeColor: baseColor, strokeOpacity: 0.9, strokeWeight: 2, fillColor: baseColor, fillOpacity: 0.15,
        });
        circle.addListener("click", () => callbacks.current.onSelect?.(marker.id));
        created.set(marker.id, {marker, pin: null, circle, restyle: selected => {
          const color = selected ? colors.selected : baseColor;
          circle.setOptions({strokeColor: color, fillColor: color, strokeWeight: selected ? 3 : 2, fillOpacity: selected ? 0.3 : 0.15});
        }});
        return;
      }
      const draggable = editable && index === 0;
      const content = (selected: boolean) => marker.precision === "APPROXIMATE"
        ? areaDot(selected)
        : new api.PinElement({background: selected ? colors.selected : baseColor, borderColor: "#ffffff", glyphColor: "#ffffff", scale: selected ? 1.25 : 1}).element;
      const pin = new api.AdvancedMarkerElement({map: cluster ? null : map, position, title: marker.title, content: content(false), gmpDraggable: draggable, zIndex: index});
      pin.addListener("click", () => callbacks.current.onSelect?.(marker.id));
      if (draggable) pin.addListener("dragend", () => {
        const next = readPosition(pin.position);
        if (next) callbacks.current.onPositionChange?.(next.lat, next.lng);
      });
      let circle: MapCircle | null = null;
      created.set(marker.id, {marker, pin, circle, restyle: selected => {
        pin.content = content(selected);
        pin.zIndex = selected ? 10_000 : index;
        // A clustered approximate location shows its area only while selected.
        if (marker.precision === "APPROXIMATE") {
          circle?.setMap(null);
          circle = selected ? new api.Circle({map, center: position, radius: marker.radiusMeters ?? 800, clickable: false,
            strokeColor: colors.selected, strokeOpacity: 0.9, strokeWeight: 2, fillColor: colors.selected, fillOpacity: 0.2}) : null;
        }
      }});
    });
    drawn.current = created;

    let active = true;
    const pins = [...created.values()].flatMap(item => item.pin ? [item.pin] : []);
    if (cluster && pins.length) {
      void import("@googlemaps/markerclusterer").then(({MarkerClusterer}) => {
        if (!active) return;
        clusterer.current = new MarkerClusterer({
          map: map as never, markers: pins as never,
          renderer: {render: ({count, position}: {count: number; position: unknown}) => new api.AdvancedMarkerElement({
            position, content: clusterBadge(count), title: `${count} locations. Select to zoom in.`, zIndex: 20_000 + count,
          }) as never},
        }) as unknown as Clusterer;
      }).catch(() => {
        // If the clusterer cannot load, show every marker individually.
        if (active) for (const pin of pins) pin.map = map;
      });
    }

    if (markers.length && (fit === "markers" || !fitted.current)) {
      fitted.current = true;
      if (markers.length === 1) {
        map.setCenter({lat: markers[0].latitude, lng: markers[0].longitude});
        map.setZoom(markers[0].precision === "APPROXIMATE" ? 14 : 16);
      } else {
        const bounds = new api.LatLngBounds();
        for (const marker of markers) bounds.extend({lat: marker.latitude, lng: marker.longitude});
        map.fitBounds(bounds, 48);
      }
    }
    return () => {
      active = false;
      clusterer.current?.clearMarkers();
      clusterer.current?.setMap(null);
      clusterer.current = null;
      for (const item of created.values()) {
        item.restyle(false);
        if (item.pin) item.pin.map = null;
        item.circle?.setMap(null);
      }
    };
    // markers is represented by markerKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, map, markerKey, cluster, editable, fit]);

  useEffect(() => {
    const item = selectedId ? drawn.current.get(selectedId) : undefined;
    if (!item) return;
    item.restyle(true);
    // Bring a selection made from the list into view, out of its cluster.
    if (map && cluster) {
      map.panTo({lat: item.marker.latitude, lng: item.marker.longitude});
      if ((map.getZoom() ?? 0) < 15) map.setZoom(15);
    }
    return () => item.restyle(false);
  }, [selectedId, map, cluster, markerKey]);

  // Google's own error overlay is replaced by the fallback provider (or the unavailable state).
  useEffect(() => {
    if (!failure) return;
    console.warn(JSON.stringify({event: "maps.google_failed", reason: failure}));
    onFailure();
  }, [failure, onFailure]);
  return <div className={`relative overflow-hidden rounded-xl border bg-muted/30 ${className}`} data-map-state={map ? "ready" : "loading"} data-map-provider="google">
    <div ref={container} role="region" aria-label={label} className="size-full" />
    {!map && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading map…</div>}
  </div>;
}
