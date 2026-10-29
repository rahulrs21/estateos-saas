"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CircleAlert, CircleCheck, ClipboardCheck, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import { formatLeadDate, LeadFormMessage, selectClassName } from "@/modules/leads/components/lead-ui";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { cn } from "@/lib/utils";
import { humanize, publicationStateLabels } from "../presentation";
import type { PortalExportPreview as PreviewData } from "../server/service";
import { portalProviders } from "../types";

const providerNames: Record<string, string> = {PROPERTY_FINDER: "Property Finder", BAYUT: "Bayut", DUBIZZLE: "dubizzle"};
type ListingChoice = {id: string; listingReference: string; title: string; listingStatus: string; property?: {propertyReference: string} | null};

export function PortalPreviewPicker({provider, listingId}: {provider: string; listingId?: string}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ListingChoice[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = (next: {provider?: string; listingId?: string}) => {
    const params = new URLSearchParams({provider: next.provider ?? provider});
    const id = next.listingId ?? listingId;
    if (id) params.set("listingId", id);
    router.push(`/settings/property-portals/preview?${params}`);
  };
  async function find(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(`/api/inventory/listings?${new URLSearchParams({search, limit: "20", offset: "0"})}`, {credentials: "same-origin", cache: "no-store"});
      const result = await response.json();
      if (!response.ok || !result.data) throw new Error(result.error?.message || "Could not search listings.");
      setResults((result.data.propertyListings as ListingChoice[]).map(row => ({...row, id: canonicalUuid(row.id)})));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not search listings."); }
    finally { setBusy(false); }
  }
  return <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Choose a listing and portal</CardTitle><CardDescription>Preview how a listing would be exported. Nothing is sent to any portal.</CardDescription></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <select aria-label="Portal" className={selectClassName} value={provider} onChange={event => go({provider: event.target.value})}>{portalProviders.map(code => <option key={code} value={code}>{providerNames[code]}</option>)}</select>
        <form onSubmit={find} className="flex gap-2"><Input aria-label="Search listing title" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Search listing title" /><Button type="submit" variant="outline" disabled={busy}><Search aria-hidden="true" />{busy ? "Searching…" : "Search"}</Button></form>
      </div>
      <LeadFormMessage message={error} />
      {results && (results.length ? <ul className="grid gap-2 sm:grid-cols-2">{results.map(row => <li key={row.id}><button type="button" onClick={() => go({listingId: row.id})} aria-current={row.id === listingId ? "true" : undefined} className={cn("w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted", row.id === listingId && "border-primary bg-secondary")}>
        <span className="block truncate text-sm font-medium">{row.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{row.listingReference} · {row.property?.propertyReference} · {humanize(row.listingStatus)}</span>
      </button></li>)}</ul> : <p className="text-sm text-muted-foreground">No listings match this search.</p>)}
    </CardContent>
  </Card>;
}

function Row({label, value}: {label: string; value: React.ReactNode}) {
  return <div className="grid grid-cols-[minmax(0,140px)_1fr] gap-3 border-b py-2 text-sm last:border-0"><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{value ?? <span className="text-muted-foreground">Not provided</span>}</dd></div>;
}

export function PortalExportPreview({data}: {data: PreviewData}) {
  const router = useRouter();
  const [format, setFormat] = useState<"JSON" | "XML">("JSON");
  const [pending, setPending] = useState(false);
  const errors = data.issues.filter(issue => issue.severity === "ERROR");
  const warnings = data.issues.filter(issue => issue.severity === "WARNING");
  const listing = data.normalized;
  const publication = data.publications.find(row => row.provider === data.provider);
  async function record() {
    setPending(true);
    try {
      const result = await leadRequest<{ready: boolean; errorCount: number}>("/api/portals/publications/validate", "POST", {listingId: data.listing.id, provider: data.provider}, data.organizationId);
      toast.success(result.ready ? "Listing recorded as ready to export." : `Validation recorded with ${result.errorCount} blocking issue${result.errorCount === 1 ? "" : "s"}.`);
      router.refresh();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Could not record the validation."); }
    finally { setPending(false); }
  }
  return <div className="space-y-5">
    <Card className={cn("shadow-xs ring-border", data.ready ? "border-emerald-500/40" : "border-destructive/40")}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {data.ready ? <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />}
          <div><h2 className="font-semibold">{data.ready ? `Ready for ${data.adapter.displayName} export` : `${errors.length} blocking issue${errors.length === 1 ? "" : "s"} for ${data.adapter.displayName}`}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{data.listing.listingReference} · {data.listing.title}. {warnings.length} warning{warnings.length === 1 ? "" : "s"}. Draft format; provider specification not verified.</p>
            {publication && <p className="mt-1 text-xs text-muted-foreground">Last recorded: {publicationStateLabels[publication.status] ?? humanize(publication.status)}{publication.lastValidatedAt ? ` on ${formatLeadDate(publication.lastValidatedAt, true)}` : ""}.</p>}
          </div>
        </div>
        <Button onClick={record} disabled={pending}><ClipboardCheck aria-hidden="true" />{pending ? "Recording…" : "Record validation result"}</Button>
      </CardContent>
    </Card>

    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Validation results</CardTitle><CardDescription>Errors block export. Warnings should be reviewed.</CardDescription></CardHeader>
        <CardContent>{data.issues.length ? <ul className="space-y-2">{[...errors, ...warnings].map(issue => <li key={issue.code + issue.field} className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm", issue.severity === "ERROR" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5")}>
          {issue.severity === "ERROR" ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Error" /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-label="Warning" />}
          <span className="min-w-0"><span className="block">{issue.message}</span><span className="mt-0.5 block font-mono text-xs text-muted-foreground">{issue.field} · {issue.code}</span></span>
        </li>)}</ul> : <p className="text-sm text-muted-foreground">No issues found.</p>}</CardContent>
      </Card>

      <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Normalized listing</CardTitle><CardDescription>Provider-independent data used by every adapter. Internal notes, ownership references and private documents are never included.</CardDescription></CardHeader>
        <CardContent><dl>
          <Row label="Transaction" value={humanize(listing.purpose)} />
          <Row label="Property type" value={humanize(listing.propertyType)} />
          <Row label="Price" value={`${listing.price.currency} ${Number(listing.price.amount).toLocaleString("en-AE", {maximumFractionDigits: 2})}${listing.price.rentalPeriod ? ` / ${humanize(listing.price.rentalPeriod).toLowerCase()}` : ""}`} />
          <Row label="Location" value={[listing.location.community, listing.location.area, listing.location.emirate && humanize(listing.location.emirate)].filter(Boolean).join(" · ") || null} />
          <Row label="Project" value={[listing.location.project, listing.location.building].filter(Boolean).join(" · ") || null} />
          <Row label="Bedrooms" value={listing.bedrooms == null ? null : listing.bedrooms === 0 ? "Studio" : listing.bedrooms} />
          <Row label="Size" value={listing.size.builtUp ?? listing.size.plot ? `${listing.size.builtUp ?? listing.size.plot} ${listing.size.unit.toLowerCase()}` : null} />
          <Row label="Photos" value={`${listing.media.filter(media => media.kind === "PHOTO").length} photos, ${listing.media.filter(media => media.kind === "FLOOR_PLAN").length} floor plans`} />
          <Row label="Agent" value={listing.agent ? `${listing.agent.name ?? "Unnamed member"}${listing.agent.active ? "" : " (inactive)"}` : null} />
          <Row label="Permit" value={listing.permit.number ? `${listing.permit.number}${listing.permit.expiryDate ? ` · expires ${listing.permit.expiryDate}` : ""}` : null} />
          <Row label="Status" value={`${humanize(listing.listingStatus)} listing · ${humanize(listing.inventoryStatus)} property`} />
        </dl></CardContent>
      </Card>
    </div>

    <Card className="shadow-xs ring-border"><CardHeader className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle>Export output</CardTitle><CardDescription>Internal preview of the draft payload. Media are referenced by ID because private files have no public URLs.</CardDescription></div>
      <div role="group" aria-label="Output format" className="flex gap-1 rounded-lg border p-1">{(["JSON", "XML"] as const).map(value => <Button key={value} size="sm" variant={format === value ? "secondary" : "ghost"} aria-pressed={format === value} onClick={() => setFormat(value)}>{value}</Button>)}</div>
    </CardHeader>
      <CardContent className="space-y-2"><pre className="max-h-[480px] overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-5" aria-label={`${format} export preview`}><code>{format === "JSON" ? data.json : data.xml}</code></pre>
        <p className="font-mono text-xs break-all text-muted-foreground">SHA-256 {data.payloadHash}</p></CardContent>
    </Card>

    {publication && publication.attempts.length > 0 && <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Validation history</CardTitle><CardDescription>Latest recorded checks for {data.adapter.displayName}.</CardDescription></CardHeader>
      <CardContent><ul className="space-y-2">{publication.attempts.map(attempt => <li key={attempt.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-xs">
        <span className="flex items-center gap-2"><Badge variant="outline">{humanize(attempt.action)}</Badge>{humanize(attempt.outcome)} · {attempt.errorCount} errors · {attempt.warningCount} warnings</span>
        <time dateTime={attempt.createdAt} className="text-muted-foreground">{formatLeadDate(attempt.createdAt, true)}</time>
      </li>)}</ul></CardContent>
    </Card>}
  </div>;
}
