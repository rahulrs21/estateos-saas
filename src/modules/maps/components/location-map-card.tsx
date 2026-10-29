"use client";

import { useMemo, useState } from "react";
import { EyeOff, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { exactGoogleMapsUrl, googleMapsUrl, mapDisplayModeLabels, type DisplayLocation, type PresentedLocation } from "../geo";
import { MapCanvas, type MapCanvasMarker } from "./map-canvas";

export type SecondaryMarker = {id: string; name: string; reference?: string | null; location: DisplayLocation};

/**
 * Location card for detail pages. It only receives a location already shaped by
 * presentMapLocation on the server, so it cannot display more than the record's
 * map display mode allows (plus exact values for administrators).
 */
export function LocationMapCard({title = "Map location", recordLabel, location, summary, secondary = [], secondaryLabel = "Buildings", showMode = true, searchRegion}: {
  title?: string; recordLabel: string; location: PresentedLocation; summary: string;
  secondary?: SecondaryMarker[]; secondaryLabel?: string;
  /** Hide the display-mode badge for locations that have no visibility setting (e.g. a head office). */
  showMode?: boolean;
  /** Appended to text-only Google Maps searches; null for addresses that already name their country. */
  searchRegion?: string | null;
}) {
  const {display, exact} = location;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markers = useMemo<MapCanvasMarker[]>(() => {
    const result: MapCanvasMarker[] = [];
    if (display.latitude != null && display.longitude != null && display.precision !== "NONE") {
      result.push({id: "record", latitude: display.latitude, longitude: display.longitude, title: recordLabel, precision: display.precision, radiusMeters: display.radiusMeters});
    }
    for (const item of secondary) {
      if (item.location.precision === "NONE" || item.location.latitude == null || item.location.longitude == null) continue;
      result.push({id: item.id, latitude: item.location.latitude, longitude: item.location.longitude, title: item.name, precision: item.location.precision, radiusMeters: item.location.radiusMeters, variant: "secondary"});
    }
    return result;
  }, [display, secondary, recordLabel]);
  const publicLink = googleMapsUrl(display, summary, searchRegion);
  const exactLink = display.precision === "EXACT" ? null : exactGoogleMapsUrl(exact);
  const visibleSecondary = secondary.filter(item => item.location.precision !== "NONE");

  return <Card>
    <CardHeader><div className="flex flex-wrap items-center justify-between gap-2"><CardTitle>{title}</CardTitle>{showMode && <Badge variant="outline">{mapDisplayModeLabels[display.mode].label}</Badge>}</div></CardHeader>
    <CardContent className="space-y-4">
      {markers.length ? <MapCanvas markers={markers} selectedId={selectedId} onSelect={setSelectedId} label={`Map showing ${recordLabel}`} className="h-72" />
        : <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 p-4 text-center" role="status">
          {display.mode === "HIDDEN" ? <EyeOff className="size-5 text-muted-foreground" aria-hidden="true" /> : <MapPin className="size-5 text-muted-foreground" aria-hidden="true" />}
          <p className="text-sm font-medium">{display.mode === "HIDDEN" ? "Location hidden from maps" : "No map location recorded"}</p>
          <p className="max-w-sm text-xs text-muted-foreground">{display.mode === "HIDDEN" ? "This record’s map visibility is set to hidden. Only the text location is shown." : "Add coordinates in the editor to show this location on a map."}</p>
        </div>}
      {display.precision === "APPROXIMATE" && <p className="text-xs text-muted-foreground">Approximate area only (within about {Math.round((display.radiusMeters ?? 800) / 100) / 10} km). The exact point is not shown.</p>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {summary && <span className="text-muted-foreground">{summary}</span>}
        {publicLink && <a href={publicLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open in Google Maps<ExternalLink className="size-3" aria-hidden="true" /></a>}
      </div>
      {exact && display.precision !== "EXACT" && <div className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">Exact stored coordinates (administrators only):</span> {exact.latitude}, {exact.longitude}</p>
        {exactLink && <a href={exactLink} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline">Open exact location<ExternalLink className="size-3" aria-hidden="true" /></a>}
      </div>}
      {exact && display.precision === "EXACT" && <p className="text-xs text-muted-foreground">Coordinates: {exact.latitude}, {exact.longitude}</p>}
      {visibleSecondary.length > 0 && <div><p className="text-xs font-medium text-muted-foreground">{secondaryLabel} on the map</p><ul className="mt-2 flex flex-wrap gap-2">{visibleSecondary.map(item => <li key={item.id}><button type="button" onClick={() => setSelectedId(item.id)} aria-pressed={selectedId === item.id} className={`rounded-full border px-3 py-1 text-xs ${selectedId === item.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{item.name}{item.reference ? ` · ${item.reference}` : ""}</button></li>)}</ul></div>}
    </CardContent>
  </Card>;
}
