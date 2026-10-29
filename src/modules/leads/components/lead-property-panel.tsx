"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Bookmark, Building2, CalendarClock, Check, ChevronLeft, ChevronRight, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { leadRequest } from "../client";
import { leadPropertyInterestSchema, leadPrimaryInterestSchema, leadPropertyViewingSchema, updateLeadPropertyViewingSchema, viewingConfirmationValues, viewingOutcomeValues } from "../property-validation";
import type { LeadPropertyData } from "../server/property-service";
import type { MatchingProperty } from "../property-matching";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "./lead-ui";

type Save = (suffix: string, method: "POST" | "PATCH", body: unknown, message: string) => Promise<boolean>;
type Property = Omit<MatchingProperty, "propertyListings_on_property">;
type PropertyChoice = {id: string; propertyReference: string; projectId?: string | null; project?: {id?: string; projectName: string} | null};
const label = (value: string) => value.replaceAll("_", " ").toLowerCase();

async function read<T>(path: string): Promise<T> {
  const response = await fetch(path, {credentials: "same-origin", cache: "no-store"});
  const result = await response.json();
  if (!response.ok || !result.data) throw new Error(result.error?.message || "Could not load property information.");
  return result.data as T;
}

function PropertySummary({property}: {property: Property}) {
  return <div className="min-w-0"><Link href={`/properties/${property.id}`} className="text-sm font-semibold text-primary hover:underline">{property.propertyReference}</Link><p className="mt-1 text-xs text-muted-foreground">{property.project?.projectName || "Standalone property"} · {label(property.propertyType)}{property.bedrooms != null ? ` · ${property.bedrooms === 0 ? "Studio" : `${property.bedrooms} bedrooms`}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">{[property.community, property.area, property.emirate && label(property.emirate)].filter(Boolean).join(" · ") || "Location not provided"}</p></div>;
}

function PrimaryInterest({leadId, data, save, pending}: {leadId: string; data: LeadPropertyData; save: Save; pending: boolean}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(data.primaryProject?.id ?? "");
  const [propertyId, setPropertyId] = useState(data.primaryProperty?.id ?? "");
  const [projects, setProjects] = useState(data.primaryProject ? [data.primaryProject] : []);
  const [properties, setProperties] = useState<PropertyChoice[]>(data.primaryProperty ? [data.primaryProperty] : []);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function searchChoices() {
    setBusy(true); setError("");
    try {
      const query = new URLSearchParams({search, limit: "50", offset: "0"});
      const [projectResult, propertyResult] = await Promise.all([
        read<{projects: {id: string; projectName: string}[]}>(`/api/inventory/projects?${query}`),
        read<{properties: PropertyChoice[]}>(`/api/inventory/properties?${query}`),
      ]);
      setProjects(projectResult.projects.map(row => ({...row, id: canonicalUuid(row.id)})));
      setProperties(propertyResult.properties.map(row => ({...row, id: canonicalUuid(row.id), projectId: row.projectId ? canonicalUuid(row.projectId) : null})));
      // Keep a selected property's project visible even when the project name
      // did not match a property-reference search.
      setProjects(rows => {
        const related = propertyResult.properties.flatMap(row => row.projectId && row.project ? [{id: canonicalUuid(row.projectId), projectName: row.project.projectName}] : []);
        return [...new Map([...rows, ...related].map(row => [row.id, row])).values()];
      });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Search failed."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    const parsed = leadPrimaryInterestSchema.safeParse({leadId, projectId: projectId || null, propertyId: propertyId || null});
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (await save("property-interest", "POST", {projectId: parsed.data.projectId, propertyId: parsed.data.propertyId}, "Property interest updated.")) setOpen(false);
  }
  return <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Interested project & property</CardTitle><CardDescription>Link this lead to actual company inventory.</CardDescription></CardHeader><CardContent className="space-y-4"><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Interested project</dt><dd className="mt-1 text-sm font-medium">{data.primaryProject ? <Link href={`/projects/${data.primaryProject.id}`} className="text-primary hover:underline">{data.primaryProject.projectName}</Link> : "No accessible project selected"}</dd></div><div><dt className="text-xs text-muted-foreground">Interested property</dt><dd className="mt-1 text-sm font-medium">{data.primaryProperty ? <Link href={`/properties/${data.primaryProperty.id}`} className="text-primary hover:underline">{data.primaryProperty.propertyReference}</Link> : "No accessible property selected"}</dd></div></dl>
    <Dialog open={open} onOpenChange={value => {if (!pending) setOpen(value);}}><DialogTrigger render={<Button variant="outline" disabled={pending} />}>Change interested inventory</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Interested inventory</DialogTitle><DialogDescription>Search project names or property references. Selecting a property also links its project.</DialogDescription></DialogHeader><div className="flex gap-2"><Input aria-label="Search project or property reference" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Project name or property reference" /><Button variant="outline" disabled={busy || pending} onClick={searchChoices}><Search />{busy ? "Searching…" : "Search"}</Button></div><p className="text-xs text-muted-foreground">Up to 50 authorized records per type. Narrow the search if needed.</p><form onSubmit={submit} className="space-y-4"><fieldset disabled={pending || busy} className="space-y-4"><LeadField id={`${prefix}-project`} label="Interested project"><select id={`${prefix}-project`} className={selectClassName} value={projectId} onChange={event => {setProjectId(event.target.value); setPropertyId("");}}><option value="">No project</option>{data.primaryProject && !projects.some(row => row.id === data.primaryProject?.id) && <option value={data.primaryProject.id}>{data.primaryProject.projectName}</option>}{projects.map(project => <option key={project.id} value={project.id}>{project.projectName}</option>)}</select></LeadField><LeadField id={`${prefix}-property`} label="Interested property"><select id={`${prefix}-property`} className={selectClassName} value={propertyId} onChange={event => {const chosen = properties.find(row => row.id === event.target.value) ?? data.primaryProperty; setPropertyId(event.target.value); if (event.target.value) setProjectId(chosen?.projectId ?? "");}}><option value="">No property</option>{data.primaryProperty && !properties.some(row => row.id === data.primaryProperty?.id) && <option value={data.primaryProperty.id}>{data.primaryProperty.propertyReference}</option>}{properties.map(property => <option key={property.id} value={property.id}>{property.propertyReference}</option>)}</select></LeadField><Button type="submit">{pending ? "Saving…" : "Save interest"}</Button></fieldset><LeadFormMessage message={error} /></form></DialogContent></Dialog>
  </CardContent></Card>;
}

type ShortlistItem = LeadPropertyData["shortlist"][number];
type Viewing = LeadPropertyData["viewings"][number];
type SearchResult = {id: string; propertyReference: string; inventoryStatus: string; project?: {projectName: string} | null; community?: string | null};
const confirmationLabels = {PENDING: "Awaiting confirmation", CONFIRMED: "Customer confirmed", DECLINED: "Customer declined"} as const;
const outcomeLabels = {POSITIVE: "Positive", NEUTRAL: "Neutral", NEGATIVE: "Negative", NO_SHOW: "Customer did not attend"} as const;

function ShortlistEditor({leadId, item, save, pending}: {leadId: string; item: ShortlistItem; save: Save; pending: boolean}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const parsed = leadPropertyInterestSchema.safeParse({leadId, propertyId: item.propertyId, status: form.get("status"), notes: form.get("notes"), expectedUpdatedAt: item.updatedAt});
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    const {leadId: ignored, ...body} = parsed.data; void ignored;
    if (await save("properties", "POST", body, "Shortlist updated.")) setOpen(false);
  }
  return <Dialog open={open} onOpenChange={value => {if (!pending) setOpen(value);}}><DialogTrigger render={<Button size="sm" variant="outline" disabled={pending} />}>Interest & feedback</DialogTrigger><DialogContent><DialogHeader><DialogTitle>{item.property.propertyReference}</DialogTitle><DialogDescription>Record the customer&apos;s interest and feedback on this property.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4"><LeadField id={`${prefix}-status`} label="Customer interest"><select id={`${prefix}-status`} name="status" className={selectClassName} defaultValue={item.status}><option value="SAVED">Saved</option><option value="INTERESTED">Interested</option><option value="NOT_INTERESTED">Not interested</option></select></LeadField><LeadField id={`${prefix}-notes`} label="Customer feedback"><textarea id={`${prefix}-notes`} name="notes" maxLength={4000} className={textareaClassName} defaultValue={item.notes ?? ""} /></LeadField><Button type="submit">{pending ? "Saving…" : "Save changes"}</Button></fieldset><LeadFormMessage message={error} /></form></DialogContent></Dialog>;
}

function RemoveFromShortlist({item, save, pending}: {item: ShortlistItem; save: Save; pending: boolean}) {
  const [open, setOpen] = useState(false);
  async function remove() {
    if (await save("properties", "POST", {propertyId: item.propertyId, status: "REMOVED", notes: item.notes, expectedUpdatedAt: item.updatedAt}, "Property removed from shortlist.")) setOpen(false);
  }
  return <Dialog open={open} onOpenChange={value => {if (!pending) setOpen(value);}}><DialogTrigger render={<Button size="sm" variant="ghost" disabled={pending} />}><Trash2 aria-hidden="true" />Remove</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Remove {item.property.propertyReference}?</DialogTitle><DialogDescription>The property leaves this customer&apos;s shortlist. Its feedback and viewing history are kept, and you can add it again later.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Keep property</Button><Button variant="destructive" disabled={pending} onClick={remove}>{pending ? "Removing…" : "Remove from shortlist"}</Button></div></DialogContent></Dialog>;
}

function AddToShortlist({shortlist, save, pending}: {shortlist: ShortlistItem[]; save: Save; pending: boolean}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function find(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const query = new URLSearchParams({search, inventoryStatus: "AVAILABLE", limit: "20", offset: "0"});
      const result = await read<{properties: SearchResult[]}>(`/api/inventory/properties?${query}`);
      setResults(result.properties.map(row => ({...row, id: canonicalUuid(row.id)})));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Search failed."); }
    finally { setBusy(false); }
  }
  async function add(propertyId: string) {
    // A previously removed or declined entry is reactivated rather than duplicated.
    const existing = shortlist.find(row => row.propertyId === propertyId);
    await save("properties", "POST", {propertyId, status: "SAVED", ...(existing ? {notes: existing.notes, expectedUpdatedAt: existing.updatedAt} : {})}, "Property added to shortlist.");
  }
  return <Dialog open={open} onOpenChange={value => {if (!pending) setOpen(value);}}><DialogTrigger render={<Button size="sm" variant="outline" disabled={pending} />}><Plus aria-hidden="true" />Add property</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Add a property to the shortlist</DialogTitle><DialogDescription>Search available properties within your inventory access by reference.</DialogDescription></DialogHeader><form onSubmit={find} className="flex gap-2"><Input aria-label="Search property reference" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Property reference" /><Button type="submit" variant="outline" disabled={busy || pending}><Search />{busy ? "Searching…" : "Search"}</Button></form><LeadFormMessage message={error} />{results && (results.length ? <><ul className="space-y-2">{results.map(row => {
    const active = shortlist.some(item => item.propertyId === row.id && item.status !== "REMOVED");
    return <li key={row.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.propertyReference}</p><p className="truncate text-xs text-muted-foreground">{[row.project?.projectName || "Standalone property", row.community].filter(Boolean).join(" · ")}</p></div><Button size="sm" variant="outline" disabled={pending || active} onClick={() => add(row.id)}>{active ? "On shortlist" : "Add"}</Button></li>;
  })}</ul><p className="text-xs text-muted-foreground">Showing up to 20 available properties. Narrow the search if needed.</p></> : <p className="text-sm text-muted-foreground">No available properties match this search.</p>)}</DialogContent></Dialog>;
}

function assigneeChoices(data: LeadPropertyData, propertyAssignee: string | null | undefined, current?: {id: string; name: string} | null) {
  // Agents are offered only when they hold both the lead and the property; the
  // database applies the same rule when saving.
  const eligible = data.viewingAssignees.filter(row => row.role !== "AGENT" || (row.id === data.leadAssignedMembershipId && row.id === propertyAssignee));
  return current && !eligible.some(row => row.id === current.id) ? [...eligible, {...current, role: "CURRENT"}] : eligible;
}

function ViewingEditor({leadId, data, propertyId, propertyAssignee, reference, viewing, save, pending}: {leadId: string; data: LeadPropertyData; propertyId: string; propertyAssignee?: string | null; reference: string; viewing?: Viewing; save: Save; pending: boolean}) {
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(viewing?.status ?? "SCHEDULED");
  const [withFollowUp, setWithFollowUp] = useState(false);
  const current = viewing?.assignedMembershipId ? {id: viewing.assignedMembershipId, name: viewing.assignedMembership?.userProfile?.displayName || viewing.assignedMembership?.email || "Current assignee"} : null;
  const choices = assigneeChoices(data, propertyAssignee, current);
  const defaultAssignee = current?.id ?? choices.find(row => row.id === data.leadAssignedMembershipId)?.id ?? choices[0]?.id ?? "";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const common = {leadId, notes: form.get("notes"), assignedMembershipId: form.get("assignedMembershipId"), customerConfirmation: form.get("customerConfirmation")};
    const parsed = viewing
      ? updateLeadPropertyViewingSchema.safeParse({...common, viewingId: viewing.id, status, expectedUpdatedAt: viewing.updatedAt,
        outcome: status === "COMPLETED" ? form.get("outcome") || null : null,
        followUp: withFollowUp && status !== "SCHEDULED" ? {title: form.get("followUpTitle"), dueAt: fromDubaiDateTimeInput(String(form.get("followUpAt") ?? ""))} : null})
      : leadPropertyViewingSchema.safeParse({...common, propertyId, scheduledAt: fromDubaiDateTimeInput(String(form.get("scheduledAt") ?? ""))});
    if (!parsed.success) {setError(parsed.error.issues[0].message); return;}
    const body = {...parsed.data} as Record<string, unknown>; delete body.leadId; delete body.viewingId;
    if (await save(viewing ? `viewings/${viewing.id}` : "viewings", viewing ? "PATCH" : "POST", body, viewing ? "Viewing updated." : "Viewing scheduled.")) setOpen(false);
  }
  return <Dialog open={open} onOpenChange={value => {if (!pending) {setOpen(value); setError(""); setStatus(viewing?.status ?? "SCHEDULED"); setWithFollowUp(false);}}}><DialogTrigger render={<Button variant="outline" size="sm" disabled={pending} />}><CalendarClock aria-hidden="true" />{viewing ? "Update viewing" : "Schedule viewing"}</DialogTrigger><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{viewing ? "Update viewing" : "Schedule a viewing"}</DialogTitle><DialogDescription>{reference} · All times are in Dubai (UTC+4).</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4"><fieldset disabled={pending} className="space-y-4">
    {!viewing && <LeadField id={`${prefix}-date`} label="Viewing date and time" hint="Choose a future date within one year."><Input id={`${prefix}-date`} name="scheduledAt" type="datetime-local" required /></LeadField>}
    <LeadField id={`${prefix}-assignee`} label="Assigned agent" hint={choices.length ? undefined : "No eligible team member. Assign this lead and property to the same agent, or ask an administrator."}><select id={`${prefix}-assignee`} name="assignedMembershipId" className={selectClassName} defaultValue={defaultAssignee} required>{choices.map(row => <option key={row.id} value={row.id}>{row.name}{row.role === "CURRENT" ? " (current)" : ""}</option>)}</select></LeadField>
    <LeadField id={`${prefix}-confirmation`} label="Customer confirmation"><select id={`${prefix}-confirmation`} name="customerConfirmation" className={selectClassName} defaultValue={viewing?.customerConfirmation ?? "PENDING"}>{viewingConfirmationValues.map(value => <option key={value} value={value}>{confirmationLabels[value]}</option>)}</select></LeadField>
    {viewing && <LeadField id={`${prefix}-status`} label="Viewing status"><select id={`${prefix}-status`} name="status" className={selectClassName} value={status} onChange={event => setStatus(event.target.value as typeof status)}><option value="SCHEDULED">Scheduled</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option></select></LeadField>}
    {viewing && status === "COMPLETED" && <LeadField id={`${prefix}-outcome`} label="Viewing outcome"><select id={`${prefix}-outcome`} name="outcome" className={selectClassName} defaultValue=""><option value="">Not recorded</option>{viewingOutcomeValues.map(value => <option key={value} value={value}>{outcomeLabels[value]}</option>)}</select></LeadField>}
    <LeadField id={`${prefix}-notes`} label={viewing && status !== "SCHEDULED" ? "Outcome notes" : "Viewing notes"}><textarea id={`${prefix}-notes`} name="notes" maxLength={4000} className={textareaClassName} defaultValue={viewing?.viewingNotes ?? ""} /></LeadField>
    {viewing && status !== "SCHEDULED" && <div className="space-y-4 rounded-lg border p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="createFollowUp" className="size-4 accent-primary" checked={withFollowUp} onChange={event => setWithFollowUp(event.target.checked)} />Create a follow-up task for the assigned agent</label>{withFollowUp && <><LeadField id={`${prefix}-follow-title`} label="Follow-up task"><Input id={`${prefix}-follow-title`} name="followUpTitle" maxLength={500} required defaultValue={`Follow up after viewing ${reference}`} /></LeadField><LeadField id={`${prefix}-follow-date`} label="Due date and time"><Input id={`${prefix}-follow-date`} name="followUpAt" type="datetime-local" required /></LeadField></>}</div>}
    <Button type="submit" disabled={!choices.length}>{pending ? "Saving…" : viewing ? "Save viewing" : "Schedule viewing"}</Button></fieldset><LeadFormMessage message={error} /></form></DialogContent></Dialog>;
}

export function LeadPropertyPanel({leadId, initialData}: {leadId: string; initialData: LeadPropertyData}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const endpoint = `/api/leads/${leadId}/properties`;
  async function save(suffix: string, method: "POST" | "PATCH", body: unknown, message: string) {
    if (pending) return false;
    setPending(true); setError(""); setSuccess("");
    try {
      await leadRequest(`/api/leads/${leadId}/${suffix}`, method, body, data.organizationId);
      setSuccess(message); toast.success(message);
      try { setData(await read<LeadPropertyData>(`${endpoint}?page=${data.page}`)); }
      catch { setError("The change was saved, but the updated view could not be loaded. Reload this page before making another change."); }
      router.refresh(); return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save this change.";
      setError(message); toast.error(message); return false;
    }
    finally {setPending(false);}
  }
  async function changePage(page: number) {
    setPending(true); setError("");
    try { setData(await read<LeadPropertyData>(`${endpoint}?page=${page}`)); }
    catch (caught) {setError(caught instanceof Error ? caught.message : "Could not load matching properties.");}
    finally {setPending(false);}
  }
  const shortlist = data.shortlist.filter(row => row.status !== "REMOVED");
  return <section className="space-y-5" aria-label="Lead property matching and viewings" aria-busy={pending}>
    <LeadFormMessage message={error} /><LeadFormMessage message={success} success />
    <PrimaryInterest key={`${data.primaryProject?.id}-${data.primaryProperty?.id}`} leadId={leadId} data={data} save={save} pending={pending} />
    <Card className="shadow-xs ring-border"><CardHeader><CardTitle>Available matching properties</CardTitle><CardDescription>Matches use saved requirements, current availability and active listing prices. Rental budgets mean annual rent; fees are excluded.</CardDescription></CardHeader><CardContent className="space-y-4">{data.matches.length ? <ul className="grid gap-3 sm:grid-cols-2">{data.matches.map(({property, listing, reasons}) => {
      const saved = data.shortlist.find(row => row.propertyId === property.id);
      return <li key={property.id} className="flex flex-col gap-4 rounded-xl border p-4"><PropertySummary property={property} /><p className="text-sm font-semibold">{listing.currency} {(Number(listing.askingPriceMinor) / 100).toLocaleString("en-AE", {maximumFractionDigits: 2})}{listing.listingPurpose === "RENT" ? ` / ${label(listing.rentalPeriod ?? "year")}` : ""}</p><ul className="space-y-1 text-xs text-muted-foreground" aria-label="Why this property matches">{reasons.map(reason => <li key={reason} className="flex items-start gap-2"><Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />{reason}</li>)}</ul><Button className="mt-auto" variant="outline" disabled={pending || (!!saved && saved.status !== "REMOVED")} onClick={() => save("properties", "POST", {propertyId: property.id, status: "SAVED", ...(saved ? {expectedUpdatedAt: saved.updatedAt} : {})}, "Property added to shortlist.")}><Bookmark aria-hidden="true" />{saved && saved.status !== "REMOVED" ? "On shortlist" : "Save property"}</Button></li>;
    })}</ul> : <EmptyState icon={Building2} title="No matching properties on this page" description="Check the lead's requirements and available inventory. Properties need an active listing in the lead's currency and must be within your access." className="py-6" />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><p className="text-xs text-muted-foreground">{data.matches.length} matches from {data.reviewed} available properties reviewed. Inventory page {data.page} of {Math.max(1, Math.ceil(data.candidateTotal / 100))}.</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={pending || data.page <= 1} onClick={() => changePage(data.page - 1)}><ChevronLeft />Previous</Button><Button size="sm" variant="outline" disabled={pending || data.page * 100 >= data.candidateTotal || data.page >= 101} onClick={() => changePage(data.page + 1)}>Next<ChevronRight /></Button></div></div>
    </CardContent></Card>
    <Card className="shadow-xs ring-border"><CardHeader className="flex flex-wrap items-start justify-between gap-3"><div className="space-y-1"><CardTitle>Saved property shortlist</CardTitle><CardDescription>Customer interest and feedback remain attached to this lead.</CardDescription></div><AddToShortlist shortlist={data.shortlist} save={save} pending={pending} /></CardHeader><CardContent className="space-y-3">{shortlist.length ? <ul className="space-y-3">{shortlist.map(item => <li key={item.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><PropertySummary property={item.property} /><div className="flex gap-2"><Badge variant="outline" className="capitalize">{label(item.status)}</Badge><Badge variant="outline" className="capitalize">{label(item.property.inventoryStatus)}</Badge></div></div>{item.notes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{item.notes}</p>}<div className="flex flex-wrap gap-2"><ShortlistEditor leadId={leadId} item={item} save={save} pending={pending} />{["SAVED", "INTERESTED"].includes(item.status) && item.property.inventoryStatus === "AVAILABLE" && !item.property.archivedAt && <ViewingEditor leadId={leadId} data={data} propertyId={item.propertyId} propertyAssignee={item.property.assignedMembershipId} reference={item.property.propertyReference} save={save} pending={pending} />}<RemoveFromShortlist item={item} save={save} pending={pending} /></div></li>)}</ul> : <EmptyState icon={Bookmark} title="No saved properties yet" description="Save a matching property or add one from your inventory to discuss it with your customer and schedule a viewing." className="py-6" />}{data.shortlistTotal > data.shortlist.length && <p className="text-xs text-muted-foreground">Showing the 100 most recently updated property interests, including removed entries.</p>}</CardContent></Card>
    <Card id="lead-viewings" className="scroll-mt-24 shadow-xs ring-border"><CardHeader><CardTitle>Viewing appointments</CardTitle><CardDescription>Times are in Dubai (UTC+4). Scheduling does not reserve a property or send a calendar invitation. Completing a viewing can create a follow-up task.</CardDescription></CardHeader><CardContent className="space-y-3">{data.viewings.length ? <ol className="space-y-3">{data.viewings.map(viewing => <li key={viewing.id} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><PropertySummary property={viewing.property} /><div className="flex flex-wrap gap-2"><Badge variant="outline" className="capitalize">{label(viewing.status)}</Badge><Badge variant="outline">{confirmationLabels[viewing.customerConfirmation]}</Badge>{viewing.outcome && <Badge variant="outline">Outcome: {outcomeLabels[viewing.outcome]}</Badge>}</div></div><time dateTime={viewing.scheduledAt} className="block text-sm font-medium">{formatLeadDate(viewing.scheduledAt, true)}</time><p className="text-xs text-muted-foreground">Assigned to {viewing.assignedMembership?.userProfile?.displayName || viewing.assignedMembership?.email || "no agent (scheduled before assignment was recorded)"}</p>{viewing.followUp && <p className="text-xs text-muted-foreground">Follow-up: {viewing.followUp.title} · due <time dateTime={viewing.followUp.dueAt}>{formatLeadDate(viewing.followUp.dueAt, true)}</time> · {label(viewing.followUp.status)}</p>}{viewing.viewingNotes && <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{viewing.viewingNotes}</p>}{viewing.status === "SCHEDULED" && <ViewingEditor leadId={leadId} data={data} propertyId={viewing.propertyId} propertyAssignee={data.shortlist.find(row => row.propertyId === viewing.propertyId)?.property.assignedMembershipId} reference={viewing.property.propertyReference} viewing={viewing} save={save} pending={pending} />}</li>)}</ol> : <EmptyState icon={CalendarClock} title="No viewings scheduled" description="Schedule a viewing from a saved property in the shortlist." className="py-6" />}{data.viewingTotal > data.viewings.length && <p className="text-xs text-muted-foreground">Showing the latest 100 appointments by viewing date.</p>}</CardContent></Card>
  </section>;
}
