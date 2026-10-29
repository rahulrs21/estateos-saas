"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leadRequest } from "@/modules/leads/client";
import { buildingInputSchema, phaseInputSchema } from "../validation";

type Company = {id: string; name: string};
type Phase = {id: string; name: string; reference?: string | null; description?: string | null; status: string; expectedHandoverDate?: string | null; actualHandoverDate?: string | null};
type Building = {id: string; phaseId?: string | null; name: string; reference?: string | null; floors?: number | null; buildingType: string; status: string; handoverDate?: string | null; latitude?: number | null; longitude?: number | null};

function messageFrom(error: unknown) { return error instanceof Error ? error.message : "The change could not be saved."; }
function dateInput(value?: string | null) { return value?.slice(0, 10) ?? ""; }
function optional(form: FormData, key: string) { const value = String(form.get(key) ?? "").trim(); return value || null; }
function numberOrNull(form: FormData, key: string) { const value = String(form.get(key) ?? "").trim(); return value ? Number(value) : null; }

function PhaseForm({company, projectId, phase}: {company: Company; projectId: string; phase?: Phase}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const parsed = phaseInputSchema.safeParse({projectId, name: String(form.get("name") ?? ""), reference: optional(form, "reference"), description: optional(form, "description"), status: String(form.get("status") ?? "PLANNED"), expectedHandoverDate: optional(form, "expectedHandoverDate"), actualHandoverDate: optional(form, "actualHandoverDate")});
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the phase details."); return; }
    setPending(true); setError("");
    try { await leadRequest(phase ? `/api/inventory/phases/${phase.id}` : "/api/inventory/phases", phase ? "PATCH" : "POST", parsed.data, company.id); toast.success(phase ? "Phase updated." : "Phase created."); router.refresh(); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={pending} className="grid gap-3 sm:grid-cols-2">
    <Field id={`phase-name-${phase?.id ?? "new"}`} label="Phase name"><Input id={`phase-name-${phase?.id ?? "new"}`} name="name" required maxLength={160} defaultValue={phase?.name ?? ""} /></Field>
    <Field id={`phase-ref-${phase?.id ?? "new"}`} label="Reference"><Input id={`phase-ref-${phase?.id ?? "new"}`} name="reference" maxLength={80} defaultValue={phase?.reference ?? ""} /></Field>
    <Field id={`phase-status-${phase?.id ?? "new"}`} label="Status"><select id={`phase-status-${phase?.id ?? "new"}`} name="status" defaultValue={phase?.status ?? "PLANNED"} className={selectClass}>{completionStatuses.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></Field>
    <Field id={`phase-handover-${phase?.id ?? "new"}`} label="Expected handover"><Input id={`phase-handover-${phase?.id ?? "new"}`} name="expectedHandoverDate" type="date" defaultValue={dateInput(phase?.expectedHandoverDate)} /></Field>
    <Field id={`phase-actual-${phase?.id ?? "new"}`} label="Actual handover"><Input id={`phase-actual-${phase?.id ?? "new"}`} name="actualHandoverDate" type="date" defaultValue={dateInput(phase?.actualHandoverDate)} /></Field>
    <div className="sm:col-span-2"><Field id={`phase-description-${phase?.id ?? "new"}`} label="Description"><textarea id={`phase-description-${phase?.id ?? "new"}`} name="description" maxLength={2000} defaultValue={phase?.description ?? ""} className="min-h-16 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></Field></div>
    {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
    <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : phase ? "Save phase" : "Add phase"}</Button></div>
  </form>;
}

const completionStatuses = ["PLANNED", "UNDER_CONSTRUCTION", "COMPLETED", "ON_HOLD"];
const buildingTypes = ["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "TOWNHOUSE", "VILLA", "OTHER"];
const selectClass = "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm";

function BuildingForm({company, projectId, phases, building}: {company: Company; projectId: string; phases: Phase[]; building?: Building}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const parsed = buildingInputSchema.safeParse({projectId, phaseId: optional(form, "phaseId"), name: String(form.get("name") ?? ""), reference: optional(form, "reference"), floors: numberOrNull(form, "floors"), buildingType: String(form.get("buildingType") ?? "RESIDENTIAL"), status: String(form.get("status") ?? "PLANNED"), handoverDate: optional(form, "handoverDate"), latitude: numberOrNull(form, "latitude"), longitude: numberOrNull(form, "longitude")});
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check the building details."); return; }
    setPending(true); setError("");
    try { await leadRequest(building ? `/api/inventory/buildings/${building.id}` : "/api/inventory/buildings", building ? "PATCH" : "POST", parsed.data, company.id); toast.success(building ? "Building updated." : "Building created."); router.refresh(); }
    catch (caught) { setError(messageFrom(caught)); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={pending} className="grid gap-3 sm:grid-cols-2">
    <Field id={`building-name-${building?.id ?? "new"}`} label="Building name"><Input id={`building-name-${building?.id ?? "new"}`} name="name" required maxLength={160} defaultValue={building?.name ?? ""} /></Field>
    <Field id={`building-ref-${building?.id ?? "new"}`} label="Reference"><Input id={`building-ref-${building?.id ?? "new"}`} name="reference" maxLength={80} defaultValue={building?.reference ?? ""} /></Field>
    <Field id={`building-type-${building?.id ?? "new"}`} label="Building type"><select id={`building-type-${building?.id ?? "new"}`} name="buildingType" defaultValue={building?.buildingType ?? "RESIDENTIAL"} className={selectClass}>{buildingTypes.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></Field>
    <Field id={`building-status-${building?.id ?? "new"}`} label="Status"><select id={`building-status-${building?.id ?? "new"}`} name="status" defaultValue={building?.status ?? "PLANNED"} className={selectClass}>{completionStatuses.map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select></Field>
    <Field id={`building-phase-${building?.id ?? "new"}`} label="Phase"><select id={`building-phase-${building?.id ?? "new"}`} name="phaseId" defaultValue={building?.phaseId ?? ""} className={selectClass}><option value="">No phase</option>{phases.map(phase => <option key={phase.id} value={phase.id}>{phase.name}</option>)}</select></Field>
    <Field id={`building-floors-${building?.id ?? "new"}`} label="Floors"><Input id={`building-floors-${building?.id ?? "new"}`} name="floors" type="number" min={0} max={300} step={1} defaultValue={building?.floors ?? ""} /></Field>
    <Field id={`building-handover-${building?.id ?? "new"}`} label="Handover date"><Input id={`building-handover-${building?.id ?? "new"}`} name="handoverDate" type="date" defaultValue={dateInput(building?.handoverDate)} /></Field>
    <Field id={`building-latitude-${building?.id ?? "new"}`} label="Latitude"><Input id={`building-latitude-${building?.id ?? "new"}`} name="latitude" type="number" min={-90} max={90} step="any" defaultValue={building?.latitude ?? ""} /></Field>
    <Field id={`building-longitude-${building?.id ?? "new"}`} label="Longitude"><Input id={`building-longitude-${building?.id ?? "new"}`} name="longitude" type="number" min={-180} max={180} step="any" defaultValue={building?.longitude ?? ""} /></Field>
    {error && <p className="text-sm text-destructive sm:col-span-2" role="alert">{error}</p>}
    <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : building ? "Save building" : "Add building"}</Button></div>
  </form>;
}

function Field({id, label, children}: {id: string; label: string; children: React.ReactNode}) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}</div>; }
function humanize(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()); }
function displayDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai"}) : "Not set"; }

export function ProjectStructureManager({company, projectId, phases, buildings, canManage}: {company: Company; projectId: string; phases: Phase[]; buildings: Building[]; canManage: boolean}) {
  return <div className="grid gap-5 xl:grid-cols-2">
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Phases</CardTitle><span className="text-xs text-muted-foreground">{phases.length} recorded</span></div></CardHeader><CardContent className="space-y-5">
      {canManage && <details className="rounded-xl border bg-muted/20 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><Plus className="size-4" aria-hidden="true" />Add a phase</summary><div className="mt-4"><PhaseForm company={company} projectId={projectId} /></div></details>}
      {phases.length ? <ul className="divide-y">{phases.map(phase => <li key={phase.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{phase.name}</p><p className="mt-1 text-xs text-muted-foreground">{phase.reference || "No reference"} · {humanize(phase.status)}</p><p className="mt-1 text-xs text-muted-foreground">Expected handover: {displayDate(phase.expectedHandoverDate)}</p></div>{canManage && <details className="text-sm"><summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1 text-xs"><Pencil className="size-3" aria-hidden="true" />Edit</summary><div className="mt-3 min-w-[min(38rem,80vw)] rounded-lg border bg-card p-4"><PhaseForm company={company} projectId={projectId} phase={phase} /></div></details>}</div></li>)}</ul> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No phases have been recorded for this project.</p>}
    </CardContent></Card>
    <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Buildings</CardTitle><span className="text-xs text-muted-foreground">{buildings.length} recorded</span></div></CardHeader><CardContent className="space-y-5">
      {canManage && <details className="rounded-xl border bg-muted/20 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><Plus className="size-4" aria-hidden="true" />Add a building</summary><div className="mt-4"><BuildingForm company={company} projectId={projectId} phases={phases} /></div></details>}
      {buildings.length ? <ul className="divide-y">{buildings.map(building => <li key={building.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-medium">{building.name}</p><p className="mt-1 text-xs text-muted-foreground">{building.reference || "No reference"} · {humanize(building.buildingType)} · {humanize(building.status)}</p><p className="mt-1 text-xs text-muted-foreground">{building.floors == null ? "Floor count not recorded" : `${building.floors} floors`} · Handover: {displayDate(building.handoverDate)}</p></div>{canManage && <details className="text-sm"><summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border px-2 py-1 text-xs"><Pencil className="size-3" aria-hidden="true" />Edit</summary><div className="mt-3 min-w-[min(38rem,80vw)] rounded-lg border bg-card p-4"><BuildingForm company={company} projectId={projectId} phases={phases} building={building} /></div></details>}</div></li>)}</ul> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">No buildings have been recorded for this project.</p>}
    </CardContent></Card>
  </div>;
}
