"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Bath, BedDouble, Bookmark, Building2, Check, ChevronLeft, ChevronRight, MapPin, Ruler } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import type { LeadPropertyData } from "../server/property-service";
import { selectClassName } from "./lead-ui";

type Save = (suffix: string, method: "POST" | "PATCH", body: unknown, message: string) => Promise<boolean>;
type Match = LeadPropertyData["matches"][number];
type Sort = "MATCH" | "PRICE_ASC" | "PRICE_DESC";

const PAGE_SIZE = 100;
const words = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
const amount = (minor: string) => Number(minor) / 100;

/** "Dubai Marina, Dubai": community, area and emirate without repeats. */
function place(property: Match["property"]) {
  const seen = new Set<string>();
  return [property.community, property.area, property.emirate && words(property.emirate)].flatMap(part => {
    const value = part?.trim();
    if (!value || seen.has(value.toLowerCase())) return [];
    seen.add(value.toLowerCase());
    return [value];
  }).join(", ");
}

/**
 * Matching inventory for a lead: one card per property with its price, key
 * specifications, location and the reasons it matches, and a save action.
 * Matches come from the server (requirements, availability, active listing
 * price); sorting here only reorders the current page.
 */
export function MatchingProperties({data, save, pending, changePage}: {
  data: LeadPropertyData; save: Save; pending: boolean; changePage: (page: number) => void | Promise<void>;
}) {
  const [sort, setSort] = useState<Sort>("MATCH");
  const matches = useMemo(() => sort === "MATCH" ? data.matches : [...data.matches].sort((a, b) => {
    const difference = amount(a.listing.askingPriceMinor) - amount(b.listing.askingPriceMinor);
    return sort === "PRICE_ASC" ? difference : -difference;
  }), [data.matches, sort]);
  const pages = Math.max(1, Math.ceil(data.candidateTotal / PAGE_SIZE));

  return <Card className="gap-4 shadow-xs ring-border">
    <CardHeader className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <CardTitle className="flex items-center gap-2">Available matching properties
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{data.matches.length}</span>
        </CardTitle>
        <CardDescription>Matches use saved requirements, current availability and active listing prices. Rental budgets mean annual rent; fees are excluded.</CardDescription>
      </div>
      {data.matches.length > 1 && <label className="flex items-center gap-2 text-xs text-muted-foreground">Sort
        <select value={sort} onChange={event => setSort(event.target.value as Sort)} className={cn(selectClassName, "h-8 w-auto py-0 text-xs")}>
          <option value="MATCH">Best match</option>
          <option value="PRICE_ASC">Price: low to high</option>
          <option value="PRICE_DESC">Price: high to low</option>
        </select>
      </label>}
    </CardHeader>
    <CardContent className="space-y-4">
      {matches.length
        ? <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {matches.map((match, index) => <MatchCard key={match.property.id} match={match} index={index} pending={pending}
            saved={data.shortlist.find(row => row.propertyId === match.property.id)} save={save} />)}
        </ul>
        : <EmptyState icon={Building2} title="No matching properties on this page" description="Check the lead's requirements and available inventory. Properties need an active listing in the lead's currency and must be within your access." className="py-6" />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">{data.matches.length} matches from {data.reviewed} available properties reviewed · page {data.page} of {pages}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={pending || data.page <= 1} onClick={() => void changePage(data.page - 1)}><ChevronLeft aria-hidden="true" />Previous</Button>
          <Button size="sm" variant="outline" disabled={pending || data.page * PAGE_SIZE >= data.candidateTotal || data.page >= 101} onClick={() => void changePage(data.page + 1)}>Next<ChevronRight aria-hidden="true" /></Button>
        </div>
      </div>
    </CardContent>
  </Card>;
}

function MatchCard({match: {property, listing, reasons}, index, saved, pending, save}: {
  match: Match; index: number; pending: boolean; save: Save; saved?: LeadPropertyData["shortlist"][number];
}) {
  const onShortlist = !!saved && saved.status !== "REMOVED";
  const rent = listing.listingPurpose === "RENT";
  const location = place(property);
  const specs = [
    property.bedrooms != null && {icon: BedDouble, text: property.bedrooms === 0 ? "Studio" : `${property.bedrooms} ${property.bedrooms === 1 ? "bed" : "beds"}`},
    property.bathrooms != null && {icon: Bath, text: `${property.bathrooms} ${property.bathrooms === 1 ? "bath" : "baths"}`},
    property.builtUpArea != null && {icon: Ruler, text: `${property.builtUpArea.toLocaleString("en-AE")} ${property.areaUnit === "SQM" ? "sq m" : "sq ft"}`},
  ].filter(Boolean) as Array<{icon: typeof Bath; text: string}>;

  return <motion.li initial={{opacity: 0, y: 4}} animate={{opacity: 1, y: 0}} transition={{duration: 0.2, delay: Math.min(index, 12) * 0.03, ease: [0.2, 0, 0, 1]}}
    className="flex flex-col rounded-xl border bg-card transition-colors hover:border-primary/40">
    <div className="flex items-start gap-3 p-4 pb-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary" aria-hidden="true"><Building2 className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/properties/${property.id}`} className="truncate text-sm font-semibold hover:text-primary hover:underline">{property.propertyReference}</Link>
          <span className="shrink-0 rounded-md border px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase">{rent ? "For rent" : "For sale"}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{property.project?.projectName || "Standalone property"} · {words(property.propertyType)}</p>
      </div>
    </div>
    <div className="px-4">
      <p className="text-lg font-semibold tracking-tight tabular-nums">{listing.currency} {amount(listing.askingPriceMinor).toLocaleString("en-AE", {maximumFractionDigits: 0})}
        {rent && <span className="ml-1 text-xs font-normal text-muted-foreground">/ {(listing.rentalPeriod ?? "YEARLY") === "MONTHLY" ? "month" : "year"}</span>}</p>
      {specs.length > 0 && <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {specs.map(({icon: Icon, text}) => <span key={text} className="inline-flex items-center gap-1"><Icon className="size-3.5" aria-hidden="true" />{text}</span>)}
      </p>}
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{location || "Location not provided"}</span></p>
    </div>
    <ul className="mt-3 flex flex-wrap gap-1.5 px-4" aria-label="Why this property matches">
      {reasons.map(reason => <li key={reason} className="inline-flex items-center gap-1 rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[11px] leading-4 text-foreground/80">
        <Check className="size-3 shrink-0 text-primary" aria-hidden="true" />{reason}
      </li>)}
    </ul>
    <div className="min-h-4 flex-1" aria-hidden="true" />
    <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
      <Link href={`/properties/${property.id}`} className="text-xs font-medium text-muted-foreground hover:text-primary">View property</Link>
      <Button size="sm" variant={onShortlist ? "secondary" : "outline"} disabled={pending || onShortlist}
        onClick={() => save("properties", "POST", {propertyId: property.id, status: "SAVED", ...(saved ? {expectedUpdatedAt: saved.updatedAt} : {})}, "Property added to shortlist.")}>
        {onShortlist ? <Check aria-hidden="true" /> : <Bookmark aria-hidden="true" />}{onShortlist ? "On shortlist" : "Save property"}
      </Button>
    </div>
  </motion.li>;
}
