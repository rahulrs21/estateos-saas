"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, LoaderCircle, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { DisplayLocation, MapBounds } from "@/modules/maps/geo";
import { googleMapsUrl } from "@/modules/maps/geo";
import { fetchMapPins, type MapPinPage } from "@/modules/maps/client/api";
import { MapCanvas, type MapCanvasMarker } from "@/modules/maps/components/map-canvas";
import { InventoryEmptyState } from "./inventory-access-state";

export type InventoryMapPinView = {
  id: string; title: string; subtitle: string; details: string; href: string; status: string;
  price: string | null; locationText: string; imageUrl?: string | null; location: DisplayLocation;
};

/** Pins kept in the browser at once; beyond this the user zooms in or narrows filters. */
const MAX_LOADED_PINS = 2000;

type Meta = Omit<MapPinPage<unknown>, "pins">;
const metaOf = ({total, mapped, mappedAll, limit, offset, hasMore, bounds}: MapPinPage<unknown>): Meta => ({total, mapped, mappedAll, limit, offset, hasMore, bounds});

/**
 * Map + list presentation of server-sanitized pins. The first page comes from
 * the server render; panning or zooming the map requests the pins inside the
 * visible area (server-side filters, bounds and paging), and "Load more" pages
 * through larger result sets. Nothing is dropped silently: the status line
 * always states how many results exist and how many are shown. The list is the
 * accessible, keyboard-operable equivalent of the map, and selecting in either
 * place opens the same summary.
 */
export function InventoryMapView<T extends {id: string}>({resource, noun, data, query, toView, initialSelectedId = null}: {
  resource: "properties" | "listings"; noun: string; data: MapPinPage<T>;
  /** Server-normalized filters to repeat on viewport and paging requests. */
  query: Record<string, string>;
  toView: (pin: T) => InventoryMapPinView;
  /** Pin to select on load (for links such as /listings?view=map&focus=<id>). */
  initialSelectedId?: string | null;
}) {
  const [pins, setPins] = useState(() => data.pins.map(toView));
  const [meta, setMeta] = useState<Meta>(() => metaOf(data));
  const [bounds, setBounds] = useState<MapBounds | null>(data.bounds);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialSelectedId && data.pins.some(pin => pin.id === initialSelectedId) ? initialSelectedId : null);
  const [loading, setLoading] = useState<"" | "area" | "more">("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const convert = useRef(toView);
  useEffect(() => { convert.current = toView; }, [toView]);
  useEffect(() => () => request.current?.abort(), []);

  const load = useCallback(async (area: MapBounds | null, offset: number) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(offset ? "more" : "area"); setError("");
    try {
      const page = await fetchMapPins<T>(resource, query, area, offset, controller.signal);
      const next = page.pins.map(pin => convert.current(pin));
      setPins(current => offset ? [...current, ...next.filter(pin => !current.some(existing => existing.id === pin.id))] : next);
      setMeta(metaOf(page));
      setBounds(area);
      if (!offset) setSelectedId(current => current && next.some(pin => pin.id === current) ? current : null);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Map results could not be loaded.");
    } finally {
      if (request.current === controller) { setLoading(""); request.current = null; }
    }
  }, [resource, query]);

  const markers = useMemo<MapCanvasMarker[]>(() => pins.flatMap(pin => pin.location.precision === "NONE" || pin.location.latitude == null || pin.location.longitude == null ? [] : [{
    id: pin.id, latitude: pin.location.latitude, longitude: pin.location.longitude, title: pin.title,
    precision: pin.location.precision, radiusMeters: pin.location.radiusMeters,
  }]), [pins]);
  const selected = pins.find(pin => pin.id === selectedId) ?? null;

  const select = useCallback((id: string) => {
    setSelectedId(id);
    // Keep the list in step with a selection made on the map.
    listRef.current?.querySelector<HTMLElement>(`[data-pin-id="${CSS.escape(id)}"]`)?.scrollIntoView({block: "nearest"});
  }, []);

  if (meta.total === 0) return <InventoryEmptyState icon={MapPinned} title={`No ${noun} found`} description="Adjust or clear the filters to see more results on the map." />;
  const outsideArea = bounds ? Math.max(0, meta.mappedAll - meta.mapped) : 0;
  const unmapped = Math.max(0, meta.total - meta.mappedAll);
  const canLoadMore = meta.hasMore && pins.length < MAX_LOADED_PINS;
  return <div className="space-y-3" data-map-view={resource}>
    <div className="text-sm text-muted-foreground" role="status" aria-live="polite" data-map-status>
      <p>
        {meta.mapped === 0
          ? bounds ? `No mapped ${noun} in this map area.` : `None of the ${meta.total} matching ${noun} has a visible map location.`
          : `Showing ${pins.length} of ${meta.mapped} mapped ${noun}${bounds ? " in this map area" : ""}.`}
        {meta.mapped > pins.length && (canLoadMore ? " Load more, zoom in or narrow the filters to see the rest." : " Zoom in or narrow the filters to see the rest.")}
      </p>
      {(outsideArea > 0 || unmapped > 0) && <p className="text-xs">
        {outsideArea > 0 && `${outsideArea} more ${outsideArea === 1 ? "is" : "are"} outside this area. `}
        {unmapped > 0 && `${unmapped} matching ${unmapped === 1 ? "record has" : "records have"} no coordinates or a hidden location and ${unmapped === 1 ? "is" : "are"} listed only in the table view.`}
      </p>}
    </div>
    {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => void load(bounds, 0)}>Retry</button></p>}
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
      <div className="relative">
        <MapCanvas markers={markers} selectedId={selectedId} onSelect={select} onViewportChange={area => void load(area, 0)} cluster fit="initial"
          label={`Map of ${noun}`} className="h-[24rem] sm:h-[28rem] lg:h-[36rem]" />
        {loading === "area" && <div className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-background/95 px-3 py-1 text-xs shadow" role="status"><LoaderCircle className="size-3 animate-spin" aria-hidden="true" />Updating results for this area…</div>}
      </div>
      <div className="flex min-h-0 flex-col gap-3 lg:h-[36rem]">
        {selected ? <PinSummary pin={selected} onClose={() => setSelectedId(null)} /> : <Card className="py-0"><CardContent className="p-4 text-sm text-muted-foreground">Select a pin or a result below to see its summary. Clusters show how many {noun} they contain; select one to zoom in.</CardContent></Card>}
        <ul ref={listRef} aria-label={`Mapped ${noun}`} className="max-h-[28rem] min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border p-1 lg:max-h-none">
          {pins.map(pin => <li key={pin.id} data-pin-id={pin.id}><button type="button" onClick={() => setSelectedId(pin.id)} aria-pressed={pin.id === selectedId}
            className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${pin.id === selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <span className="min-w-0"><span className="block truncate font-medium">{pin.title}</span><span className="block truncate text-xs text-muted-foreground">{pin.locationText || pin.subtitle}</span></span>
            {pin.price && <span className="shrink-0 text-xs text-muted-foreground">{pin.price}</span>}
          </button></li>)}
          {pins.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Move or zoom the map to find {noun}.</li>}
        </ul>
        {meta.hasMore && <Button type="button" variant="outline" onClick={() => void load(bounds, pins.length)} disabled={Boolean(loading) || !canLoadMore}>
          {loading === "more" && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {canLoadMore ? `Load ${Math.min(meta.limit, meta.mapped - pins.length)} more` : `Showing the first ${MAX_LOADED_PINS}; zoom in to see others`}
        </Button>}
      </div>
    </div>
  </div>;
}

function PinSummary({pin, onClose}: {pin: InventoryMapPinView; onClose: () => void}) {
  const mapsLink = googleMapsUrl(pin.location, pin.locationText);
  return <Card className="overflow-hidden py-0" aria-live="polite" data-pin-summary={pin.id}>
    {pin.imageUrl !== undefined && <div className="relative aspect-[16/7] bg-muted">{pin.imageUrl ? <Image src={pin.imageUrl} alt={pin.title} fill sizes="(max-width: 1024px) 100vw, 30vw" unoptimized className="object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><Building2 className="size-8" aria-hidden="true" /></div>}</div>}
    <CardContent className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-semibold">{pin.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{pin.subtitle}</p></div><Badge variant="outline">{pin.status}</Badge></div>
      <p className="text-sm text-muted-foreground">{pin.details}</p>
      {pin.price && <p className="text-sm font-medium">{pin.price}</p>}
      <p className="text-xs text-muted-foreground">{pin.locationText}{pin.location.precision === "APPROXIMATE" && " · approximate area"}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={pin.href} className={buttonVariants({size: "sm"})}>Open<ArrowRight aria-hidden="true" /></Link>
        {mapsLink && <a href={mapsLink} target="_blank" rel="noreferrer" className={buttonVariants({variant: "outline", size: "sm"})}>Google Maps</a>}
        <button type="button" onClick={onClose} className={buttonVariants({variant: "ghost", size: "sm"})}>Close</button>
      </div>
    </CardContent>
  </Card>;
}
