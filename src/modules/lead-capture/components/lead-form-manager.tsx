"use client";

import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Clipboard, Code2, ExternalLink, FileText, LoaderCircle, MoreHorizontal, Pencil, Plus, Save, Search, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { leadRequest } from "@/modules/leads/client";
import { captureFormSchema, defaultCaptureFields, type CaptureFormInput, type CaptureFieldKey } from "../validation";

type FormStatus = "DRAFT" | "ACTIVE" | "DISABLED";
type FormSummary = {
  id: string; publicId: string; name: string; status: FormStatus;
  source: string; branch: string | null; publicUrl: string;
};
type ManagerData = { organizationId: string; forms: FormSummary[]; branches: { id: string; name: string }[] };

const initial: CaptureFormInput = {
  name: "Website inquiry", status: "DRAFT", branchId: null, projectId: null,
  fields: defaultCaptureFields, consentText: "I agree that this agency may contact me about my property inquiry.",
  privacyPolicyUrl: "https://example.com/privacy", successMessage: "Thank you. Your inquiry has been received.",
};

const fieldHelp: Record<CaptureFieldKey, string> = {
  FULL_NAME: "Customer name", EMAIL: "Email address", PHONE: "Phone number", MESSAGE: "Inquiry message",
  PROPERTY_INTEREST: "Property requirements", PREFERRED_LOCATION: "Preferred location", PROPERTY_TYPE: "Property type",
  TRANSACTION_TYPE: "Buy, rent or invest", BUDGET_MIN: "Minimum budget", BUDGET_MAX: "Maximum budget", BEDROOM_PREFERENCE: "Bedroom preference",
};

const STATUS_STYLE: Record<FormStatus, {label: string; pill: string; dot: string; hint: string}> = {
  ACTIVE: {label: "Active", pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500", hint: "Accepts enquiries"},
  DRAFT: {label: "Draft", pill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500", hint: "Not public yet"},
  DISABLED: {label: "Disabled", pill: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground/60", hint: "Turned off"},
};

function StatusPill({status}: {status: FormStatus}) {
  const style = STATUS_STYLE[status];
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.pill}`}><span className={`size-1.5 rounded-full ${style.dot}`} aria-hidden="true" />{style.label}</span>;
}

/** A titled group inside the form panel. */
function Section({icon, title, description, children}: {icon: ReactNode; title: string; description: string; children: ReactNode}) {
  return <section className="space-y-4 rounded-xl border bg-card p-4 shadow-xs">
    <div className="flex items-start gap-3"><span className="rounded-lg bg-primary/10 p-2 text-primary">{icon}</span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div></div>
    {children}
  </section>;
}

/** `origin` is the app's public origin (APP_ORIGIN), read on the server so the copied URLs are the public ones. */
export function LeadFormManager({ data, origin }: { data: ManagerData; origin: string }) {
  const router = useRouter();
  const prefix = useId();
  const [form, setForm] = useState<CaptureFormInput>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<FormStatus | "ALL">("ALL");

  function set<K extends keyof CaptureFormInput>(key: K, value: CaptureFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function updateField(index: number, next: Partial<CaptureFormInput["fields"][number]>) {
    setForm((current) => ({ ...current, fields: current.fields.map((field, i) => i === index ? { ...field, ...next } : field) }));
  }

  function create() { setForm(initial); setEditingId(null); setError(""); setPanelOpen(true); }

  async function edit(id: string) {
    setLoadingId(id); setError("");
    try {
      const response = await fetch(`/api/lead-capture/forms/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as { data?: Record<string, unknown>; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message || "This form could not be loaded.");
      const current = result.data;
      setForm({
        name: String(current.name), status: current.status as CaptureFormInput["status"],
        branchId: (current.branchId as string | null) ?? null, projectId: (current.projectId as string | null) ?? null,
        fields: current.fields as CaptureFormInput["fields"], consentText: String(current.consentText),
        privacyPolicyUrl: String(current.privacyPolicyUrl), successMessage: String(current.successMessage),
      });
      setEditingId(id);
      setPanelOpen(true);
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "This form could not be loaded."); }
    finally { setLoadingId(null); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = captureFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Review the form settings.");
      return;
    }
    setPending(true);
    try {
      await leadRequest(editingId ? `/api/lead-capture/forms/${encodeURIComponent(editingId)}` : "/api/lead-capture/forms", editingId ? "PATCH" : "POST", parsed.data, data.organizationId);
      toast.success(editingId ? "Lead form updated." : "Lead form created.");
      setPanelOpen(false);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The form could not be saved."); }
    finally { setPending(false); }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); }
    catch { toast.error("Clipboard access is unavailable. Select and copy it manually."); }
  }

  // The same on the server and in the browser (no hydration mismatch).
  const absoluteUrl = (path: string) => new URL(path, origin).toString();
  // Phase 7E: the embed script passes the host page's UTM tags and click IDs into the form (docs/LEAD_ATTRIBUTION_PLAN.md).
  const embedCode = (item: FormSummary) => `<div data-estateos-form data-src="${absoluteUrl(item.publicUrl)}" data-title="${item.name.replace(/["<>&]/g, "")}" data-height="720"></div>
<script src="${absoluteUrl("/embed/lead-form.js")}" async></script>`;

  const counts = useMemo(() => ({
    ALL: data.forms.length,
    ACTIVE: data.forms.filter(item => item.status === "ACTIVE").length,
    DRAFT: data.forms.filter(item => item.status === "DRAFT").length,
    DISABLED: data.forms.filter(item => item.status === "DISABLED").length,
  }), [data.forms]);
  const visible = data.forms.filter(item => (statusFilter === "ALL" || item.status === statusFilter)
    && (!search.trim() || `${item.name} ${item.branch ?? ""} ${item.source}`.toLowerCase().includes(search.trim().toLowerCase())));
  const enabledFields = form.fields.filter(field => field.enabled).length;

  const actions = (item: FormSummary) => <DropdownMenu>
    <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.name}`} data-testid="lead-form-actions" />}><MoreHorizontal aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuItem onClick={() => void edit(item.id)}><Pencil aria-hidden="true" />Edit form</DropdownMenuItem>
      <DropdownMenuItem render={<a href={item.publicUrl} target="_blank" rel="noreferrer" />}><ExternalLink aria-hidden="true" />Preview</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void copy(absoluteUrl(item.publicUrl), "Form link")}><Clipboard aria-hidden="true" />Copy link</DropdownMenuItem>
      <DropdownMenuItem onClick={() => void copy(embedCode(item), "Embed code")}><Code2 aria-hidden="true" />Copy embed code</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;

  return <div className="space-y-6">
    {/* At a glance; each card also filters the table. */}
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {(["ALL", "ACTIVE", "DRAFT", "DISABLED"] as const).map(key => <button key={key} type="button" onClick={() => setStatusFilter(key)} aria-pressed={statusFilter === key}
        className={`group rounded-xl border bg-card p-3 text-left shadow-xs transition-shadow hover:shadow-md sm:p-4 ${statusFilter === key ? "border-primary/50 ring-2 ring-primary/20" : ""}`}>
        <p className="flex items-center justify-between text-xs font-medium text-muted-foreground">{key === "ALL" ? "All forms" : STATUS_STYLE[key].label}{key !== "ALL" && <span className={`size-2 rounded-full ${STATUS_STYLE[key].dot}`} aria-hidden="true" />}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums sm:mt-2">{counts[key]}</p>
        <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{key === "ALL" ? "Forms in this company" : STATUS_STYLE[key].hint}</p>
      </button>)}
    </div>

    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search forms by name or branch" aria-label="Search lead forms" className="pl-9" /></div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" className="justify-between sm:w-44" aria-label="Filter by status" />}>
            <span className="flex items-center gap-2">{statusFilter === "ALL" ? "All statuses" : <><span className={`size-2 rounded-full ${STATUS_STYLE[statusFilter].dot}`} aria-hidden="true" />{STATUS_STYLE[statusFilter].label}</>}</span><ChevronDown className="size-4 opacity-60" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup value={statusFilter} onValueChange={value => setStatusFilter(value as FormStatus | "ALL")}>
              <DropdownMenuRadioItem value="ALL">All statuses</DropdownMenuRadioItem>
              {(["ACTIVE", "DRAFT", "DISABLED"] as const).map(key => <DropdownMenuRadioItem key={key} value={key}>{STATUS_STYLE[key].label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button onClick={create} data-testid="lead-form-new"><Plus aria-hidden="true" />New lead form</Button>
      </div>

      {data.forms.length === 0
        ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="rounded-2xl bg-primary/10 p-4 text-primary"><FileText className="size-7" aria-hidden="true" /></span>
          <div><h2 className="font-semibold">No lead forms yet</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Create a form, add your privacy details, and activate it. Its link or embed code then works on any website.</p></div>
          <Button onClick={create}><Plus aria-hidden="true" />Create your first form</Button>
        </div>
        : visible.length === 0
        ? <p className="px-6 py-10 text-center text-sm text-muted-foreground">No forms match. <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}>Clear filters</button></p>
        : <>
          {/* Desktop: a table */}
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-muted/40"><TableRow>
                <TableHead className="pl-4">Form</TableHead><TableHead>Status</TableHead><TableHead>Destination</TableHead><TableHead>Public link</TableHead><TableHead className="w-12 pr-4"><span className="sr-only">Actions</span></TableHead>
              </TableRow></TableHeader>
              <TableBody>{visible.map(item => <TableRow key={item.id} className="group" data-testid="lead-form-row">
                <TableCell className="pl-4"><button type="button" onClick={() => void edit(item.id)} className="flex items-center gap-3 text-left">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{loadingId === item.id ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <FileText className="size-4" aria-hidden="true" />}</span>
                  <span className="min-w-0"><span className="block truncate font-medium group-hover:text-primary">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.source}</span></span>
                </button></TableCell>
                <TableCell><StatusPill status={item.status} /></TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.branch ?? "Company default"}</TableCell>
                <TableCell><div className="flex max-w-72 items-center gap-1.5"><code className="truncate rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground" title={absoluteUrl(item.publicUrl)}>{absoluteUrl(item.publicUrl).replace(/^https?:\/\//, "")}</code>
                  <Button variant="ghost" size="icon-xs" aria-label={`Copy the link of ${item.name}`} onClick={() => void copy(absoluteUrl(item.publicUrl), "Form link")}><Clipboard aria-hidden="true" /></Button></div></TableCell>
                <TableCell className="pr-4 text-right">{actions(item)}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </div>
          {/* Phones: cards */}
          <ul className="divide-y md:hidden">{visible.map(item => <li key={item.id} className="flex items-start gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate font-medium">{item.name}</p><StatusPill status={item.status} /></div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.branch ?? "Company default"} · {item.source}</p></div>
            {actions(item)}
          </li>)}</ul>
        </>}
    </Card>

    {/* Create and edit: a side panel */}
    <Sheet open={panelOpen} onOpenChange={open => { if (!pending) setPanelOpen(open); }}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="flex items-center gap-2 text-lg">{editingId ? <Pencil className="size-4 text-primary" aria-hidden="true" /> : <Sparkles className="size-4 text-primary" aria-hidden="true" />}{editingId ? "Edit lead form" : "New lead form"}</SheetTitle>
          <SheetDescription>A public enquiry form. Every submission becomes a lead in this company, with your assignment rules.</SheetDescription>
        </SheetHeader>
        <form id={`${prefix}-form`} onSubmit={save} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/30 px-6 py-5" aria-busy={pending}>
          {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <fieldset disabled={pending} className="space-y-4">
            <Section icon={<FileText className="size-4" aria-hidden="true" />} title="General" description="Its name, whether it is live, and where its leads go.">
              <div className="space-y-2"><Label htmlFor={`${prefix}-form-name`}>Form name</Label><Input id={`${prefix}-form-name`} value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={120} required autoFocus /></div>
              <div className="space-y-2"><Label>Status</Label>
                <div role="radiogroup" aria-label="Status" className="grid grid-cols-3 gap-2">{(["ACTIVE", "DRAFT", "DISABLED"] as const).map(key => <button key={key} type="button" role="radio" aria-checked={form.status === key} onClick={() => set("status", key)}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${form.status === key ? "border-primary bg-primary/10 font-medium text-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}>
                  <span className={`size-2 rounded-full ${STATUS_STYLE[key].dot}`} aria-hidden="true" />{STATUS_STYLE[key].label}{form.status === key && <Check className="size-3.5" aria-hidden="true" />}</button>)}</div>
                <p className="text-xs text-muted-foreground">{STATUS_STYLE[form.status].hint}. {form.status === "ACTIVE" ? "Visitors can submit it now." : "Only an active form accepts enquiries."}</p></div>
              <div className="space-y-2"><Label htmlFor={`${prefix}-branch`}>Lead destination branch</Label><select id={`${prefix}-branch`} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.branchId ?? ""} onChange={(event) => set("branchId", event.target.value || null)}><option value="">Company default</option>{data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><p className="text-xs text-muted-foreground">A website lead source is created for this form automatically.</p></div>
            </Section>

            <Section icon={<Check className="size-4" aria-hidden="true" />} title={`Form fields · ${enabledFields} shown`} description="Full name is always asked. Visitors must give at least one enabled contact method.">
              <ul className="divide-y rounded-lg border bg-background">{form.fields.map((field, index) => <li key={field.key} className={`grid gap-2 p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-center ${field.enabled ? "" : "opacity-60"}`}>
                <div className="flex items-center gap-2.5"><Switch checked={field.enabled} disabled={field.key === "FULL_NAME"} aria-label={`Show ${fieldHelp[field.key]}`}
                  onCheckedChange={(enabled) => updateField(index, { enabled, required: field.key === "FULL_NAME" ? true : enabled && field.required })} /><span className="text-sm">{fieldHelp[field.key]}</span></div>
                <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} maxLength={80} aria-label={`${fieldHelp[field.key]} label`} disabled={!field.enabled} className="h-8" />
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" className="size-3.5 accent-primary" checked={field.required} disabled={!field.enabled || field.key === "FULL_NAME"} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label>
              </li>)}</ul>
            </Section>

            <Section icon={<ShieldCheck className="size-4" aria-hidden="true" />} title="Consent and privacy" description="Shown above the submit button; a snapshot is kept with every enquiry.">
              <div className="space-y-2"><Label htmlFor={`${prefix}-consent`}>Consent notice</Label><textarea id={`${prefix}-consent`} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.consentText} onChange={(event) => set("consentText", event.target.value)} maxLength={1000} required /></div>
              <div className="space-y-2"><Label htmlFor={`${prefix}-privacy`}>Privacy policy URL</Label><Input id={`${prefix}-privacy`} type="url" value={form.privacyPolicyUrl} onChange={(event) => set("privacyPolicyUrl", event.target.value)} maxLength={2048} required /><p className="text-xs text-muted-foreground">Use your agency’s HTTPS privacy-policy page.</p></div>
            </Section>

            <Section icon={<Sparkles className="size-4" aria-hidden="true" />} title="After submitting" description="What the visitor sees once the enquiry is received.">
              <div className="space-y-2"><Label htmlFor={`${prefix}-success`}>Success message</Label><Input id={`${prefix}-success`} value={form.successMessage} onChange={(event) => set("successMessage", event.target.value)} maxLength={240} required /></div>
            </Section>
          </fieldset>
        </form>
        <SheetFooter className="flex-row justify-end gap-2 border-t bg-background px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setPanelOpen(false)} disabled={pending}>Cancel</Button>
          <Button type="submit" form={`${prefix}-form`} disabled={pending} data-testid="lead-form-save">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{editingId ? "Save changes" : "Create form"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>;
}
