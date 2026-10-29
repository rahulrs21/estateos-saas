"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type * as Leaflet from "leaflet";
import type Supercluster from "supercluster";
import { UAE_CENTER } from "../geo";
import type { MapCanvasMarker, MapCanvasProps } from "./map-canvas";

const colors = {primary: "#2563eb", secondary: "#64748b", selected: "#d97706"};
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

function pinIcon(L: typeof Leaflet, color: string, selected: boolean) {
  const size = selected ? 34 : 28;
  return L.divIcon({
    className: "estateos-map-pin", iconSize: [size, size], iconAnchor: [size / 2, size],
    html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${color}" stroke="#fff" stroke-width="1.5" d="M12 1.5a7.5 7.5 0 0 0-7.5 7.5c0 5.6 7.5 13.5 7.5 13.5s7.5-7.9 7.5-13.5A7.5 7.5 0 0 0 12 1.5z"/><circle cx="12" cy="9" r="2.8" fill="#fff"/></svg>`,
  });
}

function areaIcon(L: typeof Leaflet, selected: boolean) {
  const color = selected ? colors.selected : colors.primary;
  return L.divIcon({
    className: "estateos-map-area", iconSize: [18, 18], iconAnchor: [9, 9],
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;border:2px solid #fff;box-shadow:0 0 0 2px ${color};background:${color}66"></span>`,
  });
}

function clusterIcon(L: typeof Leaflet, count: number) {
  const size = count < 10 ? 32 : count < 100 ? 38 : count < 1000 ? 44 : 50;
  const label = count >= 1000 ? `${(count / 1000).toFixed(count >= 10_000 ? 0 : 1)}k` : String(count);
  return L.divIcon({
    className: "estateos-map-cluster", iconSize: [size, size], iconAnchor: [size / 2, size / 2],
    html: `<span style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;background:${colors.primary};color:#fff;font:600 12px/1 system-ui,sans-serif;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)">${label}</span>`,
  });
}

type PointProperties = {id: string};

/**
 * OpenStreetMap renderer (Leaflet) used when no Google key is configured. It
 * follows MapCanvas's contract exactly and receives only presented locations,
 * so the display-mode privacy rules are unchanged. Clustering uses
 * supercluster, the algorithm Google's marker clusterer also uses.
 */
export function LeafletCanvas({markers, selectedId, onSelect, onPositionChange, onViewportChange, cluster = false, fit = "markers", label, className = "h-80"}: MapCanvasProps) {
  const container = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const [map, setMap] = useState<Leaflet.Map | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);
  const callbacks = useRef({onSelect, onPositionChange, onViewportChange});
  useEffect(() => { callbacks.current = {onSelect, onPositionChange, onViewportChange}; }, [onSelect, onPositionChange, onViewportChange]);
  const layer = useRef<Leaflet.LayerGroup | null>(null);
  const selected = useRef(selectedId ?? null);
  const draw = useRef<() => void>(() => {});
  const fitted = useRef(false);
  const ignoreNextMove = useRef(false);
  const editable = Boolean(onPositionChange);

  useEffect(() => {
    let active = true;
    import("leaflet").then(module => { if (active) setL(module.default ?? module); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!L || !container.current || map) return;
    const created = L.map(container.current, {center: [UAE_CENTER.latitude, UAE_CENTER.longitude], zoom: 7, scrollWheelZoom: false, attributionControl: true});
    let loaded = false;
    L.tileLayer(TILE_URL, {maxZoom: 19, attribution: ATTRIBUTION})
      .on("tileload", () => { loaded = true; setTilesFailed(false); })
      .on("tileerror", () => { if (!loaded) setTilesFailed(true); })
      .addTo(created);
    // Scroll-zoom only after the user focuses the map, so page scrolling is not hijacked.
    created.on("focus", () => created.scrollWheelZoom.enable());
    created.on("blur", () => created.scrollWheelZoom.disable());
    layer.current = L.layerGroup().addTo(created);
    setMap(created);
    return () => { created.remove(); layer.current = null; setMap(null); };
    // The map is created once per mounted container.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L]);

  useEffect(() => {
    if (!map || !editable) return;
    const handler = (event: Leaflet.LeafletMouseEvent) => callbacks.current.onPositionChange?.(event.latlng.lat, event.latlng.lng);
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, editable]);

  useEffect(() => {
    if (!map) return;
    let timer: number | undefined;
    const handler = () => {
      draw.current();
      if (ignoreNextMove.current) { ignoreNextMove.current = false; return; }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const bounds = map.getBounds();
        callbacks.current.onViewportChange?.({south: bounds.getSouth(), west: bounds.getWest(), north: bounds.getNorth(), east: bounds.getEast()});
      }, 400);
    };
    map.on("moveend", handler);
    return () => { map.off("moveend", handler); window.clearTimeout(timer); };
  }, [map]);

  const markerKey = markers.map(marker => `${marker.id}:${marker.latitude}:${marker.longitude}:${marker.precision}`).join("|");
  useEffect(() => {
    if (!L || !map || !layer.current) return;
    const group = layer.current;
    const byId = new Map(markers.map(marker => [marker.id, marker]));
    let clusterIndex: Supercluster<PointProperties> | null = null;

    const drawMarker = (marker: MapCanvasMarker, position: number) => {
      const isSelected = marker.id === selected.current;
      const baseColor = colors[marker.variant ?? "primary"];
      const latLng: Leaflet.LatLngExpression = [marker.latitude, marker.longitude];
      if (marker.precision === "APPROXIMATE") {
        if (!cluster || isSelected) {
          const color = isSelected ? colors.selected : baseColor;
          L.circle(latLng, {radius: marker.radiusMeters ?? 800, color, weight: isSelected ? 3 : 2, fillColor: color, fillOpacity: isSelected ? 0.3 : 0.15})
            .on("click", () => callbacks.current.onSelect?.(marker.id)).addTo(group);
        }
        if (cluster) L.marker(latLng, {icon: areaIcon(L, isSelected), title: marker.title, keyboard: true, zIndexOffset: isSelected ? 1000 : 0})
          .on("click", () => callbacks.current.onSelect?.(marker.id)).addTo(group);
        return;
      }
      const draggable = editable && position === 0;
      const pin = L.marker(latLng, {icon: pinIcon(L, isSelected ? colors.selected : baseColor, isSelected), title: marker.title, keyboard: true, draggable, zIndexOffset: isSelected ? 1000 : 0})
        .on("click", () => callbacks.current.onSelect?.(marker.id));
      if (draggable) pin.on("dragend", () => { const next = pin.getLatLng(); callbacks.current.onPositionChange?.(next.lat, next.lng); });
      pin.addTo(group);
    };

    draw.current = () => {
      group.clearLayers();
      if (!clusterIndex) { markers.forEach(drawMarker); return; }
      const bounds = map.getBounds();
      const zoom = Math.round(map.getZoom());
      for (const feature of clusterIndex.getClusters([bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()], zoom)) {
        const [lng, lat] = feature.geometry.coordinates;
        const properties = feature.properties as PointProperties & {cluster?: boolean; cluster_id?: number; point_count?: number};
        if (properties.cluster && properties.cluster_id != null) {
          const clusterId = properties.cluster_id;
          const count = properties.point_count ?? 0;
          L.marker([lat, lng], {icon: clusterIcon(L, count), title: `${count} locations. Select to zoom in.`, keyboard: true, zIndexOffset: 2000})
            .on("click", () => map.flyTo([lat, lng], Math.min(clusterIndex!.getClusterExpansionZoom(clusterId), 18)))
            .addTo(group);
        } else {
          const marker = byId.get(properties.id);
          if (marker) drawMarker(marker, 0);
        }
      }
      const current = selected.current ? byId.get(selected.current) : undefined;
      // A selected approximate location always shows its area, even inside a cluster.
      if (current?.precision === "APPROXIMATE") L.circle([current.latitude, current.longitude], {radius: current.radiusMeters ?? 800, color: colors.selected, weight: 2, fillOpacity: 0.2, interactive: false}).addTo(group);
    };

    let active = true;
    if (cluster && markers.length) {
      void import("supercluster").then(({default: SuperclusterClass}) => {
        if (!active) return;
        clusterIndex = new SuperclusterClass<PointProperties>({radius: 60, maxZoom: 17});
        clusterIndex.load(markers.map(marker => ({type: "Feature", properties: {id: marker.id}, geometry: {type: "Point", coordinates: [marker.longitude, marker.latitude]}})));
        draw.current();
      });
    }
    draw.current();

    if (markers.length && (fit === "markers" || !fitted.current)) {
      fitted.current = true;
      // Skip the move caused by this fit; expire the skip in case the fit did not move the map.
      ignoreNextMove.current = true;
      window.setTimeout(() => { ignoreNextMove.current = false; }, 1000);
      if (markers.length === 1) map.setView([markers[0].latitude, markers[0].longitude], markers[0].precision === "APPROXIMATE" ? 14 : 16);
      else map.fitBounds(L.latLngBounds(markers.map(marker => [marker.latitude, marker.longitude] as [number, number])), {padding: [48, 48]});
    }
    return () => { active = false; group.clearLayers(); };
    // markers is represented by markerKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, map, markerKey, cluster, editable, fit]);

  useEffect(() => {
    selected.current = selectedId ?? null;
    draw.current();
    const marker = selectedId ? markers.find(item => item.id === selectedId) : undefined;
    // Bring a selection made from the list into view, out of its cluster.
    if (map && cluster && marker) map.flyTo([marker.latitude, marker.longitude], Math.max(map.getZoom(), 15));
    // markers is represented by markerKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, map, cluster, markerKey]);

  return <div className={`relative isolate overflow-hidden rounded-xl border bg-muted/30 ${className}`} data-map-state={map ? "ready" : "loading"} data-map-provider="osm">
    <div ref={container} role="region" aria-label={label} className="size-full" />
    {!map && <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Loading map…</div>}
    {tilesFailed && <p className="absolute top-2 left-1/2 z-[1000] -translate-x-1/2 rounded-full border bg-background/95 px-3 py-1 text-xs text-muted-foreground shadow" role="status">Map tiles could not be loaded. Markers are still shown.</p>}
  </div>;
}
