"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapCanvas, type MapCanvasMarker } from "@/modules/maps/components/map-canvas";

export type DashboardMapPin = {
  id: string; reference: string; status: string; place: string;
  latitude: number; longitude: number; precision: "EXACT" | "APPROXIMATE"; radiusMeters: number | null;
};

/**
 * Clustered overview map. Selecting a pin shows the property below the map
 * with a link to it; the full map view (with its keyboard-operable list) is
 * linked from the card header.
 */
export function DashboardMapCanvas({pins}: {pins: DashboardMapPin[]}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markers = useMemo<MapCanvasMarker[]>(() => pins.map(pin => ({
    id: pin.id, latitude: pin.latitude, longitude: pin.longitude, title: pin.reference, precision: pin.precision, radiusMeters: pin.radiusMeters,
  })), [pins]);
  const selected = pins.find(pin => pin.id === selectedId) ?? null;
  return <>
    <MapCanvas tone="brand" markers={markers} selectedId={selectedId} onSelect={setSelectedId} cluster fit="initial" label="Map of property locations" className="min-h-80 flex-1"
      unavailable="Maps are turned off for this environment. Property locations remain available in the property list." />
    <div className="flex min-h-9 items-center justify-between gap-3 text-xs" aria-live="polite">
      {selected
        ? <><span className="min-w-0 truncate"><span className="font-medium text-foreground">{selected.reference}</span><span className="text-muted-foreground"> · {selected.status} · {selected.place}{selected.precision === "APPROXIMATE" ? " (approximate area)" : ""}</span></span>
          <Link href={`/properties/${selected.id}`} className="shrink-0 font-medium text-primary hover:underline">View property</Link></>
        : <span className="text-muted-foreground">{pins.length ? "Select a pin to see the property." : "No property has a visible map location yet."}</span>}
    </div>
  </>;
}
