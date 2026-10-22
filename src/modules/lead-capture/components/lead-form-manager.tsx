"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Clipboard, ExternalLink, LoaderCircle, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { captureFormSchema, defaultCaptureFields, type CaptureFormInput, type CaptureFieldKey } from "../validation";

type FormSummary = {
  id: string; publicId: string; name: string; status: "DRAFT" | "ACTIVE" | "DISABLED";
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

export function LeadFormManager({ data }: { data: ManagerData }) {
  const router = useRouter();
  const prefix = useId();
  const [form, setForm] = useState<CaptureFormInput>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof CaptureFormInput>(key: K, value: CaptureFormInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function updateField(index: number, next: Partial<CaptureFormInput["fields"][number]>) {
    setForm((current) => ({ ...current, fields: current.fields.map((field, i) => i === index ? { ...field, ...next } : field) }));
  }

  async function edit(id: string) {
    setPending(true); setError("");
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
      document.getElementById(`${prefix}-form-name`)?.focus();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This form could not be loaded."); }
    finally { setPending(false); }
  }

  function reset() { setForm(initial); setEditingId(null); setError(""); }

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
      reset();
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The form could not be saved."); }
    finally { setPending(false); }
  }

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); toast.success(`${label} copied.`); }
    catch { setError("Clipboard access is unavailable. Select and copy the URL manually."); }
  }

  const absoluteUrl = (path: string) => typeof window === "undefined" ? path : new URL(path, window.location.origin).toString();

  return <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
    <Card><CardContent className="p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3"><span className="rounded-xl bg-primary/10 p-2 text-primary"><Plus className="size-4" aria-hidden="true" /></span><div><h2 className="font-semibold">{editingId ? "Edit lead form" : "Create a lead form"}</h2><p className="mt-1 text-sm text-muted-foreground">Configure a public inquiry form and where captured leads enter your workspace.</p></div></div>
      <form onSubmit={save} className="space-y-5" aria-busy={pending}>
        {error && <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
        <fieldset disabled={pending} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor={`${prefix}-form-name`}>Form name</Label><Input id={`${prefix}-form-name`} value={form.name} onChange={(event) => set("name", event.target.value)} maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor={`${prefix}-status`}>Status</Label><select id={`${prefix}-status`} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.status} onChange={(event) => set("status", event.target.value as CaptureFormInput["status"])}><option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="DISABLED">Disabled</option></select></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${prefix}-branch`}>Lead destination branch</Label><select id={`${prefix}-branch`} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm" value={form.branchId ?? ""} onChange={(event) => set("branchId", event.target.value || null)}><option value="">Company default</option>{data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select><p className="text-xs text-muted-foreground">A website lead source is created for this form automatically.</p></div>
          </div>
          <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Form fields</legend><p className="text-xs text-muted-foreground">Full name is required. Visitors must provide at least one enabled contact method.</p>
            {form.fields.map((field, index) => <div key={field.key} className="grid gap-2 border-t pt-3 first:border-0 first:pt-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={field.enabled} onChange={(event) => updateField(index, { enabled: event.target.checked, required: field.key === "FULL_NAME" ? true : event.target.checked && field.required })} aria-label={`Enable ${fieldHelp[field.key]}`} disabled={field.key === "FULL_NAME"} />{fieldHelp[field.key]}</label>
              <Input value={field.label} onChange={(event) => updateField(index, { label: event.target.value })} maxLength={80} aria-label={`${fieldHelp[field.key]} label`} disabled={!field.enabled} />
              <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={field.required} disabled={!field.enabled || field.key === "FULL_NAME"} onChange={(event) => updateField(index, { required: event.target.checked })} />Required</label>
            </div>)}
          </fieldset>
          <div className="space-y-2"><Label htmlFor={`${prefix}-consent`}>Consent notice</Label><textarea id={`${prefix}-consent`} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.consentText} onChange={(event) => set("consentText", event.target.value)} maxLength={1000} required /></div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-privacy`}>Privacy policy URL</Label><Input id={`${prefix}-privacy`} type="url" value={form.privacyPolicyUrl} onChange={(event) => set("privacyPolicyUrl", event.target.value)} maxLength={2048} required /><p className="text-xs text-muted-foreground">Use your agency’s HTTPS privacy-policy page.</p></div>
          <div className="space-y-2"><Label htmlFor={`${prefix}-success`}>Success message</Label><Input id={`${prefix}-success`} value={form.successMessage} onChange={(event) => set("successMessage", event.target.value)} maxLength={240} required /></div>
        </fieldset>
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{editingId ? "Save changes" : "Create form"}</Button>{editingId && <Button type="button" variant="outline" onClick={reset} disabled={pending}>Cancel edit</Button>}</div>
      </form>
    </CardContent></Card>

    <section className="space-y-4" aria-labelledby={`${prefix}-existing-heading`}>
      <div><h2 id={`${prefix}-existing-heading`} className="font-semibold">Your lead forms</h2><p className="mt-1 text-sm text-muted-foreground">Public submissions create a lead in the currently active company.</p></div>
      {data.forms.length ? data.forms.map((formItem) => {
        const publicUrl = absoluteUrl(formItem.publicUrl);
        const embed = `<iframe src="${publicUrl}" title="${formItem.name.replace(/["<>]/g, "")}" width="100%" height="720" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        return <Card key={formItem.id}><CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{formItem.name}</h3><p className="mt-1 text-xs text-muted-foreground">{formItem.source}{formItem.branch ? ` · ${formItem.branch}` : " · Company default"}</p></div><span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{formItem.status}</span></div>
          <p className="truncate rounded-md bg-muted px-2.5 py-2 font-mono text-xs" title={publicUrl}>{publicUrl}</p>
          <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => void copy(publicUrl, "Public form URL")}><Clipboard aria-hidden="true" />Copy URL</Button><Button type="button" variant="outline" size="sm" onClick={() => void edit(formItem.id)} disabled={pending}><Pencil aria-hidden="true" />Edit</Button><a className={buttonVariants({ variant: "ghost", size: "sm" })} href={formItem.publicUrl} target="_blank" rel="noreferrer"><ExternalLink aria-hidden="true" />Preview</a><Button type="button" variant="ghost" size="sm" onClick={() => void copy(embed, "Embed code")}><Clipboard aria-hidden="true" />Copy embed</Button></div>
        </CardContent></Card>;
      }) : <Card><CardContent className="p-4 text-sm text-muted-foreground">No public lead forms yet. Create a draft, add your privacy details, and activate it when ready.</CardContent></Card>}
    </section>
  </div>;
}

