"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BedDouble, Building2, ExternalLink, History, LoaderCircle, MapPin, Pencil, Plus, Ruler, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import { describeLocation, emirateLabels, emirates, type PresentedLocation } from "@/modules/maps/geo";
import { LocationMapCard } from "@/modules/maps/components/location-map-card";
import { InventoryEmptyState, InventoryPagination } from "./inventory-access-state";
import { InventoryMapView } from "./inventory-map-view";
import { MediaGallery } from "./property-management";
import type { InventoryMapData, ListingMapPin } from "../server/views";
import type { ListingSort, ListingView } from "../validation";
import { AiContentLink } from "@/modules/ai/content/components/ai-content-link";

type Company = {id: string; name: string; role: string};
type Agent = {email: string; userProfile?: {displayName: string}};
type MediaItem = {id: string; fileName: string; contentType: string; mediaKind: string; sortOrder: number; isCover: boolean};

export type ListingListItem = {
  id: string; title: string; listingReference: string; listingPurpose: string; marketType: string; askingPriceMinor: string; currency: string;
  rentalPeriod?: string | null; listingStatus: string; publicationStatus: string; permitExpiryDate?: string | null; assignedMembership?: Agent | null;
  property: {
    id: string; propertyReference: string; propertyType: string; bedrooms?: number | null; builtUpArea?: number | null; areaUnit?: string | null;
    emirate?: string | null; city?: string | null; community?: string | null; project?: {projectName: string} | null;
    inventoryMedias_on_property?: Array<{id: string}>;
  };
};

export type ListingDetailRecord = ListingListItem & {
  description?: string | null; assignedMembershipId?: string | null; advertisingPermitNumber?: string | null; permitVerificationUrl?: string | null;
  createdAt?: string; updatedAt?: string;
  property: ListingListItem["property"] & {
    bathrooms?: number | null; plotArea?: number | null; area?: string | null; inventoryStatus?: string | null; mapDisplayMode?: string | null;
    building?: {id: string; name: string} | null; inventoryMedias_on_property?: MediaItem[];
  };
};

export type ListingHistoryEntry = {id: string; kind: string; createdAt: string; actor: string | null; from: string | null; to: string | null};

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const workflowStatuses = ["DRAFT", "PENDING_REVIEW", "APPROVED", "ACTIVE", "PAUSED", "CLOSED", "ARCHIVED"];
const propertyTypes = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"];
const sortLabels: Record<ListingSort, string> = {UPDATED_DESC: "Recently updated", CREATED_DESC: "Newest", PRICE_ASC: "Price: low to high", PRICE_DESC: "Price: high to low"};
const statusTone: Record<string, string> = {
  DRAFT: "", PENDING_REVIEW: "border-amber-500/40 text-amber-600 dark:text-amber-400", APPROVED: "border-sky-500/40 text-sky-600 dark:text-sky-400",
  ACTIVE: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400", PAUSED: "border-orange-500/40 text-orange-600 dark:text-orange-400",
  CLOSED: "text-muted-foreground", ARCHIVED: "text-muted-foreground",
};

export function humanize(value?: string | null) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, character => character.toUpperCase()) : "Not set";
}
function priceLabel(minor: string, currency: string, rentalPeriod?: string | null) {
  return `${currency} ${(Number(BigInt(minor)) / 100).toLocaleString("en-AE")}${rentalPeriod ? ` / ${rentalPeriod === "MONTHLY" ? "month" : "year"}` : ""}`;
}
const unitLabel = (unit?: string | null) => unit === "SQM" ? "sq m" : "sq ft";
function bedsLabel(bedrooms?: number | null) { return bedrooms == null ? null : bedrooms === 0 ? "Studio" : `${bedrooms} bed`; }
function sizeLabel(size?: number | null, unit?: string | null) { return size == null ? null : `${size.toLocaleString("en-AE")} ${unitLabel(unit)}`; }
function coverUrl(listing: ListingListItem) {
  const cover = listing.property.inventoryMedias_on_property?.[0];
  return cover ? `/api/inventory/media/${cover.id}/content` : null;
}
function permitExpiringSoon(date?: string | null) {
  if (!date) return false;
  const days = (new Date(date.slice(0, 10)).getTime() - Date.now()) / 86_400_000;
  return days < 30;
}

export function StatusBadge({status}: {status: string}) {
  return <Badge variant="outline" className={statusTone[status] ?? ""}>{humanize(status)}</Badge>;
}

/** Label for a workflow step, phrased as the action a user takes. */
export function transitionLabel(from: string, to: string) {
  if (to === "PENDING_REVIEW") return "Submit for review";
  if (to === "DRAFT") return "Return to draft";
  if (to === "APPROVED") return "Approve";
  if (to === "ACTIVE") return from === "PAUSED" ? "Resume" : "Activate";
  if (to === "PAUSED") return "Pause";
  if (to === "CLOSED") return "Close";
  if (to === "ARCHIVED") return "Archive";
  return humanize(to);
}

function useStatusChange(companyId: string, listingId: string, status: string) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  async function change(next: string) {
    if ((next === "CLOSED" || next === "ARCHIVED") && !window.confirm(`${transitionLabel(status, next)} this listing? ${next === "ARCHIVED" ? "Archived listings cannot be reopened." : "Closed listings can only be archived afterwards."}`)) return;
    setPending(next);
    try {
      await leadRequest(`/api/inventory/listings/${listingId}/status`, "POST", {expectedStatus: status, status: next}, companyId);
      toast.success(`Listing moved to ${humanize(next)}.`);
      router.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The status could not be changed."); }
    finally { setPending(null); }
  }
  return {pending, change};
}

/** Workflow buttons for the detail page; only steps this viewer may take are shown. */
export function ListingStatusActions({companyId, listingId, status, transitions}: {companyId: string; listingId: string; status: string; transitions: string[]}) {
  const {pending, change} = useStatusChange(companyId, listingId, status);
  if (!transitions.length) return null;
  const primary = transitions.filter(next => !["DRAFT", "CLOSED", "ARCHIVED"].includes(next));
  const secondary = transitions.filter(next => ["DRAFT", "CLOSED", "ARCHIVED"].includes(next));
  return <div className="flex flex-wrap items-center gap-2" aria-label="Listing workflow" role="group">
    {primary.map(next => <Button key={next} size="sm" onClick={() => change(next)} disabled={Boolean(pending)}>{pending === next && <LoaderCircle className="animate-spin" aria-hidden="true" />}{transitionLabel(status, next)}</Button>)}
    {secondary.map(next => <Button key={next} size="sm" variant="outline" onClick={() => change(next)} disabled={Boolean(pending)}>{pending === next && <LoaderCircle className="animate-spin" aria-hidden="true" />}{transitionLabel(status, next)}</Button>)}
  </div>;
}

/** Compact status changer for table rows. */
function RowStatusSelect({companyId, listing, transitions}: {companyId: string; listing: ListingListItem; transitions: string[]}) {
  const {pending, change} = useStatusChange(companyId, listing.id, listing.listingStatus);
  if (!transitions.length) return <span className="text-xs text-muted-foreground">—</span>;
  return <select aria-label={`Change status of ${listing.title}`} value="" disabled={Boolean(pending)} onChange={event => { if (event.target.value) void change(event.target.value); }} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
    <option value="">{pending ? "Saving…" : "Change status"}</option>
    {transitions.map(next => <option key={next} value={next}>{transitionLabel(listing.listingStatus, next)}</option>)}
  </select>;
}

function Thumbnail({listing, className}: {listing: ListingListItem; className: string}) {
  const url = coverUrl(listing);
  const [failed, setFailed] = useState(false);
  return <div className={`relative overflow-hidden bg-muted ${className}`}>
    {url && !failed
      ? <Image src={url} alt="" fill sizes="(max-width: 640px) 100vw, 320px" unoptimized className="object-cover" onError={() => setFailed(true)} />
      : <div className="flex size-full items-center justify-center text-muted-foreground"><Building2 className="size-5" aria-hidden="true" /></div>}
  </div>;
}

export function ListingList({company, listings, total, limit, offset, canManage, filters, view, sort, map, statusCounts, transitions, focus}: {
  company: Company; listings: ListingListItem[]; total: number; limit: number; offset: number; canManage: boolean;
  filters: Record<string, string>; view: ListingView; sort: ListingSort; map: InventoryMapData<ListingMapPin> | null;
  statusCounts: Record<string, number>; transitions: Record<string, string[]>; focus?: string | null;
}) {
  const baseParams = (overrides: Record<string, string | null> = {}) => {
    const params = new URLSearchParams(Object.entries({...filters, ...(sort !== "UPDATED_DESC" ? {sort} : {}), ...(view !== "table" ? {view} : {})}).filter(([, value]) => Boolean(value)));
    for (const [key, value] of Object.entries(overrides)) { if (value) params.set(key, value); else params.delete(key); }
    return params.size ? `/listings?${params}` : "/listings";
  };
  const hasFilters = Object.values(filters).some(Boolean);
  const allCount = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  const pageQuery = new URLSearchParams(baseParams().split("?")[1] ?? "");

  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow={company.name} title="Marketing listings" description="Prepare, review and track company listings separately from property inventory. External publication is not connected.">
      {(canManage || company.role === "AGENT") && <Link href="/listings/new" className={buttonVariants({size: "lg"})}><Plus aria-hidden="true" />Create listing</Link>}
      <Link href="/properties" className={buttonVariants({variant: "outline"})}>Property inventory<ArrowRight aria-hidden="true" /></Link>
    </PageHeader>

    <nav aria-label="Listings by status" className="flex gap-2 overflow-x-auto pb-1">
      {[{status: "", label: "All", count: allCount}, ...workflowStatuses.map(status => ({status, label: humanize(status), count: statusCounts[status] ?? 0}))].map(item => {
        const active = (filters.listingStatus ?? "") === item.status;
        return <Link key={item.label} href={baseParams({listingStatus: item.status || null, page: null})} aria-current={active ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
          <span>{item.label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-primary/15" : "bg-muted"}`}>{item.count}</span>
        </Link>;
      })}
    </nav>

    <Card><CardContent className="p-4"><form action="/listings" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
      <div className="relative"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input name="search" aria-label="Search listing title" defaultValue={filters.search} placeholder="Search title" className="pl-9" /></div>
      <select name="listingStatus" aria-label="Listing status" defaultValue={filters.listingStatus} className={selectClass}><option value="">All statuses</option>{workflowStatuses.map(status => <option key={status} value={status}>{humanize(status)}</option>)}</select>
      <select name="purpose" aria-label="Listing purpose" defaultValue={filters.purpose} className={selectClass}><option value="">Sale or rental</option><option value="SALE">Sale</option><option value="RENT">Rental</option></select>
      <select name="marketType" aria-label="Market type" defaultValue={filters.marketType} className={selectClass}><option value="">Off-plan or secondary</option><option value="OFF_PLAN">Off-plan</option><option value="SECONDARY">Secondary</option></select>
      <select name="emirate" aria-label="Emirate" defaultValue={filters.emirate} className={selectClass}><option value="">All emirates</option>{emirates.map(emirate => <option key={emirate} value={emirate}>{emirateLabels[emirate]}</option>)}</select>
      <Input name="community" aria-label="Community" defaultValue={filters.community} placeholder="Community" maxLength={160} />
      <select name="propertyType" aria-label="Property type" defaultValue={filters.propertyType} className={selectClass}><option value="">All property types</option>{propertyTypes.map(type => <option key={type} value={type}>{humanize(type)}</option>)}</select>
      <Input name="minimumPrice" aria-label="Minimum asking price" defaultValue={filters.minimumPrice} type="number" min="0" step="0.01" placeholder="Min price" />
      <Input name="maximumPrice" aria-label="Maximum asking price" defaultValue={filters.maximumPrice} type="number" min="0" step="0.01" placeholder="Max price" />
      <select name="sort" aria-label="Sort listings" defaultValue={sort} className={selectClass}>{Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      {view !== "table" && <input type="hidden" name="view" value={view} />}
      <Button variant="outline" type="submit" className="sm:col-span-2 lg:col-span-1">Apply filters</Button>
    </form></CardContent></Card>

    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{total} {total === 1 ? "listing" : "listings"}{hasFilters ? " match these filters" : ""}</p>
      <div className="flex gap-1" role="group" aria-label="View">
        {(["table", "cards", "map"] as const).map(option => <Link key={option} aria-current={view === option ? "page" : undefined} className={buttonVariants({variant: view === option ? "secondary" : "ghost", size: "sm"})} href={baseParams({view: option === "table" ? null : option, page: null, focus: null})}>{humanize(option)}</Link>)}
      </div>
    </div>

    {view === "map" && map
      ? <InventoryMapView key={JSON.stringify(map.query)} resource="listings" noun="listings" data={map} query={map.query} initialSelectedId={focus} toView={pin => ({
        id: pin.id, title: pin.title, href: `/listings/${pin.id}`, status: humanize(pin.listingStatus),
        subtitle: `${pin.listingReference} · ${humanize(pin.listingPurpose)} · ${humanize(pin.marketType)}`,
        details: [pin.property.propertyReference, humanize(pin.property.propertyType), bedsLabel(pin.property.bedrooms), pin.property.project?.projectName].filter(Boolean).join(" · "),
        price: priceLabel(pin.askingPriceMinor, pin.currency, pin.rentalPeriod), locationText: describeLocation(pin.property), location: pin.location,
      })} />
      : listings.length === 0
        ? <InventoryEmptyState title={hasFilters ? "No listings match these filters" : "No marketing listings"} description={hasFilters ? "Adjust or clear the filters to see more listings." : "Create a listing from available property inventory when your marketing details are ready."} action={canManage && <Link href="/listings/new" className={buttonVariants()}><Plus aria-hidden="true" />Create listing</Link>} />
        : view === "cards"
          ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-listing-cards>{listings.map(listing => <Card key={listing.id} className="group overflow-hidden py-0">
            <Link href={`/listings/${listing.id}`} className="block"><Thumbnail listing={listing} className="aspect-[16/9]" /></Link>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2"><Link href={`/listings/${listing.id}`} className="min-w-0 font-semibold hover:text-primary"><span className="line-clamp-2">{listing.title}</span></Link><StatusBadge status={listing.listingStatus} /></div>
              <p className="text-lg font-semibold">{priceLabel(listing.askingPriceMinor, listing.currency, listing.rentalPeriod)}</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span>{humanize(listing.property.propertyType)}</span>
                {bedsLabel(listing.property.bedrooms) && <span className="inline-flex items-center gap-1"><BedDouble className="size-3.5" aria-hidden="true" />{bedsLabel(listing.property.bedrooms)}</span>}
                {sizeLabel(listing.property.builtUpArea, listing.property.areaUnit) && <span className="inline-flex items-center gap-1"><Ruler className="size-3.5" aria-hidden="true" />{sizeLabel(listing.property.builtUpArea, listing.property.areaUnit)}</span>}
              </p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" aria-hidden="true" />{describeLocation(listing.property) || "Location not set"}</p>
              <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs text-muted-foreground"><span>{listing.listingReference} · {humanize(listing.listingPurpose)}</span><RowStatusSelect companyId={company.id} listing={listing} transitions={transitions[listing.id] ?? []} /></div>
            </CardContent>
          </Card>)}</div><InventoryPagination basePath="/listings" page={Math.max(1, offset / limit + 1)} total={total} limit={limit} query={pageQuery.toString()} /></>
          : <Card className="overflow-hidden py-0"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["", "Listing", "Property", "Location", "Price", "Agent", "Status", "Actions"].map((label, index) => <th key={index} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y">{listings.map(listing => <tr key={listing.id} data-listing-row={listing.id}>
              <td className="py-2 pl-4"><Link href={`/listings/${listing.id}`} aria-label={`Open ${listing.title}`}><Thumbnail listing={listing} className="h-12 w-16 rounded-md" /></Link></td>
              <td className="px-4 py-3"><Link className="font-medium hover:text-primary" href={`/listings/${listing.id}`}>{listing.title}</Link><p className="mt-1 text-xs text-muted-foreground">{listing.listingReference} · {humanize(listing.listingPurpose)} · {humanize(listing.marketType)}</p></td>
              <td className="px-4 py-3"><Link href={`/properties/${listing.property.id}`} className="hover:text-primary">{listing.property.propertyReference}</Link><p className="mt-1 text-xs text-muted-foreground">{[humanize(listing.property.propertyType), bedsLabel(listing.property.bedrooms), sizeLabel(listing.property.builtUpArea, listing.property.areaUnit)].filter(Boolean).join(" · ")}</p></td>
              <td className="px-4 py-3"><p>{describeLocation(listing.property) || <span className="text-muted-foreground">Not set</span>}</p><Link href={baseParams({view: "map", focus: listing.id, page: null})} className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"><MapPin className="size-3" aria-hidden="true" />Map</Link></td>
              <td className="px-4 py-3 font-medium">{priceLabel(listing.askingPriceMinor, listing.currency, listing.rentalPeriod)}</td>
              <td className="px-4 py-3">{listing.assignedMembership?.userProfile?.displayName || listing.assignedMembership?.email || <span className="text-muted-foreground">Unassigned</span>}</td>
              <td className="px-4 py-3"><StatusBadge status={listing.listingStatus} />{permitExpiringSoon(listing.permitExpiryDate) && <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">Permit {new Date(listing.permitExpiryDate!.slice(0, 10)) < new Date() ? "expired" : "expiring"}</p>}</td>
              <td className="px-4 py-3"><RowStatusSelect companyId={company.id} listing={listing} transitions={transitions[listing.id] ?? []} /></td>
            </tr>)}</tbody>
          </table></div><InventoryPagination basePath="/listings" page={Math.max(1, offset / limit + 1)} total={total} limit={limit} query={pageQuery.toString()} /></Card>}
  </div>;
}

export function ListingDetail({company, listing, canManage, canEdit, location, history, transitions}: {
  company: Company; listing: ListingDetailRecord; canManage: boolean; canEdit: boolean; location: PresentedLocation;
  history: ListingHistoryEntry[]; transitions: string[];
}) {
  const property = listing.property;
  const media = property.inventoryMedias_on_property ?? [];
  const size = property.propertyType === "PLOT" ? property.plotArea : property.builtUpArea;
  const perUnit = size && size > 0 ? `${listing.currency} ${Math.round(Number(BigInt(listing.askingPriceMinor)) / 100 / size).toLocaleString("en-AE")} / ${unitLabel(property.areaUnit)}` : null;
  const safeUrl = listing.permitVerificationUrl?.startsWith("https://") ? listing.permitVerificationUrl : null;
  const field = (name: string, value: React.ReactNode) => <div><dt className="text-xs text-muted-foreground">{name}</dt><dd className="mt-1 break-words text-sm font-medium">{value || "Not provided"}</dd></div>;
  const facts: Array<[string, string | null]> = [
    ["Price", priceLabel(listing.askingPriceMinor, listing.currency, listing.rentalPeriod)], ["Price per area", perUnit],
    ["Bedrooms", bedsLabel(property.bedrooms)], ["Bathrooms", property.bathrooms == null ? null : String(property.bathrooms)],
    [property.propertyType === "PLOT" ? "Plot area" : "Built-up area", sizeLabel(size, property.areaUnit)], ["Availability", property.inventoryStatus ? humanize(property.inventoryStatus) : null],
  ];

  return <div className="mx-auto w-full max-w-[1300px] space-y-6 p-4 sm:p-6 lg:p-8">
    <Link href="/listings" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Listings</Link>
    <PageHeader eyebrow={company.name} title={listing.title} description={`${listing.listingReference} · ${humanize(listing.listingPurpose)} · ${humanize(listing.marketType)}`}>
      <AiContentLink label="Generate Advertising Copy" type="ADVERTISING" purpose="META" record={{kind: "listingId", id: listing.id}} />
      {canEdit && <Link href={`/listings/${listing.id}/edit`} className={buttonVariants({variant: "outline"})}><Pencil aria-hidden="true" />Edit listing</Link>}
    </PageHeader>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">Status</span><StatusBadge status={listing.listingStatus} /><Badge variant="secondary">{listing.publicationStatus === "READY" ? "Internal review ready" : "Readiness not assessed"}</Badge></div>
      <ListingStatusActions companyId={company.id} listingId={listing.id} status={listing.listingStatus} transitions={transitions} />
    </div>

    <Card>
      <CardHeader><div className="flex items-center justify-between gap-2"><CardTitle>Photos and files</CardTitle>{canManage && <Link href={`/properties/${property.id}/edit?step=media`} className={buttonVariants({variant: "outline", size: "sm"})}>Manage files</Link>}</div></CardHeader>
      <CardContent>{media.length ? <MediaGallery company={company} media={media} canManage={false} /> : <InventoryEmptyState title="No photos yet" description={canManage ? "Add property photos from the property's media step; they appear on every listing of that property." : "Photos added to this property will appear here."} />}</CardContent>
    </Card>

    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Key facts">{facts.map(([name, value]) => <div key={name} className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{name}</dt><dd className="mt-1 text-sm font-semibold">{value ?? "—"}</dd></div>)}</dl>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,.7fr)]">
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Marketing details</CardTitle></CardHeader><CardContent className="space-y-5">
          <dl className="grid gap-5 sm:grid-cols-2">
            {field("Property inventory", <Link className="text-primary hover:underline" href={`/properties/${property.id}`}>{property.propertyReference} · {humanize(property.propertyType)}</Link>)}
            {field("Project", property.project?.projectName)}
            {field("Listing agent", listing.assignedMembership?.userProfile?.displayName || listing.assignedMembership?.email)}
            {field("Rental period", listing.rentalPeriod ? humanize(listing.rentalPeriod) : null)}
          </dl>
          <div className="border-t pt-4"><h2 className="text-sm font-semibold">Description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{listing.description || "No marketing description recorded."}</p></div>
        </CardContent></Card>
        <LocationMapCard title="Property location" recordLabel={property.propertyReference} location={location} summary={describeLocation(property)} />
      </div>
      <div className="space-y-5">
        <Card><CardHeader><CardTitle>Advertising reference</CardTitle></CardHeader><CardContent className="space-y-4">
          <dl className="space-y-4">{field("Permit reference", listing.advertisingPermitNumber)}{field("Expiry date", listing.permitExpiryDate?.slice(0, 10))}</dl>
          {permitExpiringSoon(listing.permitExpiryDate) && <p role="status" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">The advertising permit {new Date(listing.permitExpiryDate!.slice(0, 10)) < new Date() ? "has expired" : "expires within 30 days"}. Renew it before advertising.</p>}
          {safeUrl ? <a href={safeUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open permit reference <ExternalLink className="size-3" aria-hidden="true" /></a> : <p className="text-xs text-muted-foreground">No HTTPS reference stored. EstateOS does not verify permit status or claim regulatory approval.</p>}
          <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">Listings are internal records. No portal feed or external advertising is published from this page.</p>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4" aria-hidden="true" />Status history</CardTitle></CardHeader><CardContent>
          {history.length ? <ol className="space-y-3" data-listing-history>{history.map(entry => <li key={entry.id} className="border-l-2 pl-3 text-sm">
            <p className="font-medium">{entry.from && entry.to ? `${humanize(entry.from)} → ${humanize(entry.to)}` : entry.kind === "PROPERTY_LISTING_CREATED" ? "Listing created" : entry.kind === "PROPERTY_LISTING_ARCHIVED" ? "Listing archived" : "Details updated"}</p>
            <p className="text-xs text-muted-foreground">{entry.actor ?? "A team member"} · {new Date(entry.createdAt).toLocaleString("en-AE", {dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai"})}</p>
          </li>)}</ol> : <p className="text-sm text-muted-foreground">No activity recorded yet.</p>}
        </CardContent></Card>
      </div>
    </div>
  </div>;
}
