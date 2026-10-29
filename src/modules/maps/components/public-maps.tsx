"use client";

import { useMemo, useState } from "react";
import { BedDouble, ExternalLink, MapPin } from "lucide-react";
import { googleMapsUrl } from "../geo";
import type { PublicListingPin, PublicProjectMapData } from "../public";
import { MapCanvas, type MapCanvasMarker } from "./map-canvas";

/**
 * Client-facing map components for future agency websites and landing pages.
 * They accept only the sanitized shapes produced by ../public.ts, never CRM
 * records, and make no CRM API calls. Props are serialized into the page, so
 * the allowlist in public.ts is what keeps exact coordinates, addresses and
 * internal fields out of the HTML.
 */

function formatPrice({amountMinor, currency, rentalPeriod}: {amountMinor: string; currency: string; rentalPeriod?: string | null}) {
  const major = Number(BigInt(amountMinor) / BigInt(100));
  const amount = `${currency} ${major.toLocaleString("en-AE")}`;
  return rentalPeriod ? `${amount} / ${rentalPeriod === "MONTHLY" ? "month" : "year"}` : amount;
}

function humanize(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

const markerFor = (id: string, title: string, location: PublicListingPin["location"]): MapCanvasMarker[] =>
  location.precision === "NONE" || location.latitude == null || location.longitude == null ? []
    : [{id, title, latitude: location.latitude, longitude: location.longitude, precision: location.precision, radiusMeters: location.radiusMeters}];

export function PublicListingMap({listings, title = "Properties on the map", emptyText = "No properties are available right now."}: {
  listings: PublicListingPin[]; title?: string; emptyText?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markers = useMemo(() => listings.flatMap(listing => markerFor(listing.id, listing.title, listing.location)), [listings]);
  const selected = listings.find(listing => listing.id === selectedId) ?? null;
  const unmapped = listings.length - markers.length;

  return <section className="space-y-3" aria-label={title} data-public-map="listings">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground" role="status">{listings.length === 0 ? emptyText : `${listings.length} ${listings.length === 1 ? "property" : "properties"}${unmapped ? `, ${unmapped} without a map location` : ""}`}</p>
    </div>
    {listings.length > 0 && <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)]">
      <MapCanvas markers={markers} selectedId={selectedId} onSelect={setSelectedId} cluster label={title} className="h-80 md:h-[30rem]"
        unavailable="The interactive map is unavailable. Browse the properties in the list." />
      <div className="flex min-h-0 flex-col gap-3 md:h-[30rem]">
        {selected && <PublicListingCard listing={selected} />}
        <ul aria-label="Properties" className="max-h-96 min-h-0 flex-1 space-y-1 overflow-y-auto rounded-xl border p-1 md:max-h-none">
          {listings.map(listing => <li key={listing.id}><button type="button" onClick={() => setSelectedId(listing.id)} aria-pressed={listing.id === selectedId}
            className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${listing.id === selectedId ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}>
            <span className="min-w-0"><span className="block truncate font-medium">{listing.title}</span><span className="block truncate text-xs text-muted-foreground">{listing.locationText}</span><span className="block text-[11px] text-muted-foreground">{`Permit ${listing.advertisingPermitNumber}`}</span></span>
            <span className="shrink-0 text-xs text-muted-foreground">{formatPrice(listing.price)}</span>
          </button></li>)}
        </ul>
      </div>
    </div>}
  </section>;
}

function PublicListingCard({listing}: {listing: PublicListingPin}) {
  const mapsLink = googleMapsUrl(listing.location, listing.locationText);
  return <article className="space-y-2 rounded-xl border p-4" aria-live="polite">
    <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{listing.title}</h3><span className="rounded-full border px-2 py-0.5 text-xs">{listing.purpose === "RENT" ? "For rent" : "For sale"}</span></div>
    <p className="text-sm font-medium">{formatPrice(listing.price)}</p>
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span>{humanize(listing.propertyType)}</span>
      {listing.bedrooms != null && <span className="inline-flex items-center gap-1"><BedDouble className="size-3.5" aria-hidden="true" />{listing.bedrooms === 0 ? "Studio" : `${listing.bedrooms} bed`}</span>}
      {listing.size && <span>{listing.size.value.toLocaleString("en-AE")} {listing.size.unit.toLowerCase()}</span>}
    </p>
    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" aria-hidden="true" />{listing.locationText}{listing.location.precision === "APPROXIMATE" && " · approximate area"}</p>
    <p className="text-xs text-muted-foreground">{`Advertising permit ${listing.advertisingPermitNumber}`}</p>
    <div className="flex flex-wrap gap-3 text-sm">
      {listing.href && <a href={listing.href} className="font-medium text-primary hover:underline">View property</a>}
      {mapsLink && <a href={mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Google Maps<ExternalLink className="size-3" aria-hidden="true" /></a>}
    </div>
  </article>;
}

export function PublicProjectMap({project}: {project: PublicProjectMapData}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const markers = useMemo(() => [
    ...markerFor(project.id, project.name, project.location),
    ...project.buildings.flatMap(building => markerFor(building.id, building.name, building.location).map(marker => ({...marker, variant: "secondary" as const}))),
  ], [project]);
  const mapsLink = googleMapsUrl(project.location, project.locationText);

  return <section className="space-y-3" aria-label={`${project.name} location`} data-public-map="project">
    <div><h2 className="text-lg font-semibold">{project.name}</h2>
      <p className="text-sm text-muted-foreground">{[project.developerName, project.locationText].filter(Boolean).join(" · ")}</p></div>
    {markers.length > 0
      ? <MapCanvas markers={markers} selectedId={selectedId} onSelect={setSelectedId} label={`Map of ${project.name}`} className="h-72 md:h-96"
        unavailable="The interactive map is unavailable. The project location is described below." />
      : <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{project.locationText ? `Located in ${project.locationText}.` : "Location available on request."}</p>}
    {project.location.precision === "APPROXIMATE" && <p className="text-xs text-muted-foreground">The map shows the approximate area of this project.</p>}
    {project.buildings.length > 0 && <ul aria-label="Buildings" className="flex flex-wrap gap-2">{project.buildings.map(building => <li key={building.id}>
      <button type="button" onClick={() => setSelectedId(building.id)} aria-pressed={selectedId === building.id} className={`rounded-full border px-3 py-1 text-xs ${selectedId === building.id ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>{building.name}</button>
    </li>)}</ul>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      {project.startingPrice && <span>From {formatPrice(project.startingPrice)}</span>}
      {project.expectedHandoverDate && <span className="text-muted-foreground">Expected handover {new Date(project.expectedHandoverDate).toLocaleDateString("en-AE", {month: "short", year: "numeric", timeZone: "Asia/Dubai"})}</span>}
      {mapsLink && <a href={mapsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open in Google Maps<ExternalLink className="size-3" aria-hidden="true" /></a>}
    </div>
  </section>;
}
