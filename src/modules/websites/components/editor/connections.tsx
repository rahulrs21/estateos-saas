"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, ExternalLink, Loader2, Mail, MapPin, MessageCircle, Phone, Plus, Clock, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { getBrandSettings, saveBrandSettings, type BrandSettings } from "@/modules/ai/content/client";
import { defaultCaptureFields } from "@/modules/lead-capture/validation";
import { errorMessage, websitesGet, websitesSend } from "../../client";
import type { LinkedAgent } from "../../linked";
import { Field, inputClass, textareaClass } from "./controls";
import { useEditorServices } from "./editor-context";

/*
 * Controls that connect a page to company records: the lead form that
 * receives enquiries, the approved company contacts and an agent card.
 * They call the existing server APIs; roles are enforced there.
 */

const button = "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";
const primary = `${button} bg-sky-500 text-white hover:bg-sky-400`;
const ghost = `${button} border border-white/15 text-zinc-200 hover:border-sky-400 hover:text-white`;

// --- Lead form ---------------------------------------------------------------------------

export function LeadFormControl() {
  const {payload, organizationId, pageId, isAdministrator, refresh} = useEditorServices();
  const forms = (payload.forms ?? []).filter(form => form.status !== "DISABLED");
  const [choice, setChoice] = useState(payload.form?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const selectId = useId();

  const connect = async (formId: string | null) => {
    setBusy(true);
    try {
      await websitesSend(`/api/websites/pages/${pageId}/form`, organizationId, "POST", {formId}, "The lead form could not be connected.");
      await refresh();
      toast.success(formId ? "Lead form connected. Enquiries create leads with your assignment rules." : "Lead form disconnected.");
    } catch (error) { toast.error(errorMessage(error, "The lead form could not be connected.")); } finally { setBusy(false); }
  };

  return <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-[13px] font-medium text-zinc-100">Lead form</p>
        {payload.form
          ? <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="size-3.5" aria-hidden="true" />{payload.form.name} · {payload.form.status.toLowerCase()}</p>
          : <p className="mt-0.5 text-xs text-amber-200">Not connected. The canvas shows a sample form; visitors see the form once one is connected.</p>}
      </div>
    </div>
    {!isAdministrator
      ? <p className="text-[11px] leading-4 text-zinc-400">Only company owners and administrators can connect lead forms. Ask one of them to connect a form to this page.</p>
      : <>
        <Field label="Choose a form" htmlFor={selectId}>
          <div className="flex gap-2">
            <select id={selectId} value={choice} onChange={event => setChoice(event.target.value)} className={`${inputClass} [&>option]:bg-zinc-900`}>
              <option value="">No form</option>
              {forms.map(form => <option key={form.id} value={form.id}>{form.name} ({form.status.toLowerCase()})</option>)}
            </select>
            <button type="button" className={primary} disabled={busy || choice === (payload.form?.id ?? "")} onClick={() => connect(choice || null)}>{busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}Connect</button>
          </div>
        </Field>
        {creating ? <CreateFormDialog onCancel={() => setCreating(false)} onCreated={async id => { setCreating(false); setChoice(id); await connect(id); }} />
          : <button type="button" className={ghost} onClick={() => setCreating(true)}><Plus className="size-3.5" aria-hidden="true" />Create a new form</button>}
      </>}
  </div>;
}

function CreateFormDialog({onCancel, onCreated}: {onCancel: () => void; onCreated: (id: string) => Promise<void>}) {
  const {payload, organizationId} = useEditorServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState(() => defaultCaptureFields.map(field => ({...field})));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const created = await websitesSend<{form: {id: string}}>("/api/lead-capture/forms", organizationId, "POST", {
        name: String(form.get("name") ?? "").trim(), status: "ACTIVE", fields,
        consentText: String(form.get("consentText") ?? "").trim(), privacyPolicyUrl: String(form.get("privacyPolicyUrl") ?? "").trim(),
        successMessage: String(form.get("successMessage") ?? "").trim(),
      }, "The form could not be created.");
      toast.success("Lead form created.");
      await onCreated(created.form.id);
    } catch (failure) { setError(errorMessage(failure, "The form could not be created.")); } finally { setBusy(false); }
  };
  const toggle = (key: string, patch: Partial<{enabled: boolean; required: boolean}>) => setFields(current => current.map(field => field.key === key ? {...field, ...patch, ...(patch.enabled === false ? {required: false} : {})} : field));
  return <form onSubmit={submit} className="space-y-3 rounded-md border border-sky-400/30 bg-sky-500/5 p-3" aria-label="New lead form">
    <div className="flex items-center justify-between"><p className="text-[13px] font-semibold text-white">New lead form</p><button type="button" onClick={onCancel} aria-label="Cancel" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-3.5" /></button></div>
    <label className="block space-y-1 text-xs text-zinc-300">Form name<input name="name" required minLength={2} maxLength={120} defaultValue={`${payload.page.title} enquiries`.slice(0, 120)} className={inputClass} /></label>
    <fieldset className="space-y-1.5"><legend className="text-xs text-zinc-300">Fields</legend>
      {fields.slice(0, 7).map(field => <div key={field.key} className="flex items-center justify-between gap-2 text-xs">
        <span className="text-zinc-200">{field.label}</span>
        <span className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={field.enabled} disabled={field.key === "FULL_NAME"} onChange={event => toggle(field.key, {enabled: event.target.checked})} className="accent-sky-500" />Show</label>
          <label className="flex items-center gap-1 text-zinc-400"><input type="checkbox" checked={field.required} disabled={field.key === "FULL_NAME" || !field.enabled} onChange={event => toggle(field.key, {required: event.target.checked})} className="accent-sky-500" />Required</label>
        </span>
      </div>)}
    </fieldset>
    <label className="block space-y-1 text-xs text-zinc-300">Consent text<textarea name="consentText" required minLength={8} maxLength={1000} className={`${textareaClass} min-h-16 text-xs`}
      defaultValue={`I agree that ${payload.linked.company.name} may contact me about this enquiry and process my details as described in the privacy policy.`} /></label>
    <label className="block space-y-1 text-xs text-zinc-300">Privacy policy link (https)<input name="privacyPolicyUrl" type="url" required maxLength={2048} placeholder="https://www.your-agency.ae/privacy" className={inputClass} /></label>
    <label className="block space-y-1 text-xs text-zinc-300">Thank-you message<input name="successMessage" required maxLength={240} defaultValue="Thank you. Our team will contact you shortly." className={inputClass} /></label>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="flex justify-end gap-2"><button type="button" className={ghost} onClick={onCancel}>Cancel</button><button type="submit" className={primary} disabled={busy}>{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}Create and connect</button></div>
  </form>;
}

/** A switch whose visible label is provided by the surrounding row. */
function Switch({label, checked, onChange}: {label: string; checked: boolean; onChange: (checked: boolean) => void}) {
  return <label className="relative inline-flex shrink-0 cursor-pointer" title={label}>
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} aria-label={label} className="peer sr-only" />
    <span className="h-5 w-9 rounded-full bg-white/15 transition-colors peer-checked:bg-sky-500 peer-focus-visible:ring-2 peer-focus-visible:ring-sky-300" />
    <span className="absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
  </label>;
}

// --- Company contacts --------------------------------------------------------------------

const CONTACT_ROWS = [
  {key: "showPhone", label: "Phone", icon: Phone, value: (company: Company) => company.phone},
  {key: "showWhatsapp", label: "WhatsApp", icon: MessageCircle, value: (company: Company) => company.whatsapp},
  {key: "showEmail", label: "Email", icon: Mail, value: (company: Company) => company.email},
  {key: "showAddress", label: "Office address", icon: MapPin, value: (company: Company) => company.address ?? null},
  {key: "showHours", label: "Office hours", icon: Clock, value: (company: Company) => company.hours ?? null},
] as const;
type Company = ReturnType<typeof useEditorServices>["payload"]["linked"]["company"];

export function ContactDetailsControl({props, onProps}: {props: Record<string, unknown>; onProps: (props: Record<string, unknown>) => void}) {
  const {payload, isAdministrator, openBrand} = useEditorServices();
  const company = payload.linked.company;
  return <div className="space-y-2.5 rounded-md border border-white/10 bg-white/[0.03] p-3">
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-100"><Building2 className="size-4 text-sky-300" aria-hidden="true" />Company contacts</p>
    {CONTACT_ROWS.map(row => {
      const value = row.value(company);
      const Icon = row.icon;
      return <div key={row.key} className="flex items-center justify-between gap-2">
        <span className="min-w-0"><span className="flex items-center gap-1.5 text-xs text-zinc-200"><Icon className="size-3.5 text-zinc-400" aria-hidden="true" />{row.label}</span>
          <span className={`block truncate text-[11px] ${value ? "text-sky-200" : "text-zinc-500"}`}>{value ?? "Not set"}</span></span>
        <Switch label={`Show ${row.label.toLowerCase()}`} checked={Boolean(props[row.key])} onChange={checked => onProps({...props, [row.key]: checked})} />
      </div>;
    })}
    {isAdministrator ? <button type="button" className={ghost} onClick={openBrand}>Edit company contacts</button>
      : <p className="text-[11px] text-zinc-500">Company contacts are managed by owners and administrators in the brand settings.</p>}
  </div>;
}

// --- Agent card --------------------------------------------------------------------------

type AgentOption = LinkedAgent & {role: string};

export function AgentControl({value, onChange}: {value: string | null; onChange: (agentId: string | null) => void}) {
  const {payload, organizationId, isAdministrator, previewAgent} = useEditorServices();
  const [agents, setAgents] = useState<AgentOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectId = useId();
  useEffect(() => {
    if (!isAdministrator) return;
    let active = true;
    websitesGet<AgentOption[]>("/api/websites/agents", "Team members could not be loaded.").then(rows => { if (active) setAgents(rows); }, failure => { if (active) setError(errorMessage(failure, "Team members could not be loaded.")); });
    return () => { active = false; };
  }, [isAdministrator]);
  const current = agents?.find(agent => agent.id === value) ?? (payload.linked.agents ?? []).find(agent => agent.id === value) ?? null;
  const choose = (id: string) => {
    const agent = agents?.find(item => item.id === id) ?? null;
    if (agent) previewAgent(agent);
    onChange(agent ? agent.id : null);
  };
  const saveCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!current) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const rows = await websitesSend<AgentOption[]>(`/api/websites/agents/${current.id}`, organizationId, "PUT", {
        websiteTitle: String(form.get("title") ?? ""), websitePhone: String(form.get("phone") ?? ""), websiteWhatsapp: String(form.get("whatsapp") ?? ""),
      }, "The agent card could not be saved.");
      setAgents(rows);
      const updated = rows.find(item => item.id === current.id);
      if (updated) previewAgent(updated);
      toast.success("Agent card saved. It updates on every page that shows this agent.");
    } catch (failure) { toast.error(errorMessage(failure, "The agent card could not be saved.")); } finally { setBusy(false); }
  };
  return <div className="space-y-2.5 rounded-md border border-white/10 bg-white/[0.03] p-3">
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-100"><UserRound className="size-4 text-sky-300" aria-hidden="true" />Agent card</p>
    {!isAdministrator
      ? <p className="text-[11px] leading-4 text-zinc-400">{current ? `Shows ${current.name}. ` : ""}Owners and administrators choose the agent shown on a page.</p>
      : error ? <p role="alert" className="text-xs text-red-300">{error}</p>
      : !agents ? <p className="flex items-center gap-1.5 text-xs text-zinc-400"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Loading team…</p>
      : <>
        <Field label="Show an agent" htmlFor={selectId}>
          <select id={selectId} value={value ?? ""} onChange={event => choose(event.target.value)} className={`${inputClass} [&>option]:bg-zinc-900`}>
            <option value="">No agent (company contacts only)</option>
            {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}{agent.title ? ` · ${agent.title}` : ""}</option>)}
          </select>
        </Field>
        {current && <form key={current.id} onSubmit={saveCard} className="space-y-2" aria-label="Agent card">
          <p className="text-[11px] text-zinc-500">Shown publicly: name, title, phone, WhatsApp and work email ({current.email ?? "not set"}). Publishing asks you to confirm the agent agreed.</p>
          <input name="title" defaultValue={current.title ?? ""} maxLength={80} placeholder="Title, for example Senior property consultant" aria-label="Agent title" className={`${inputClass} text-xs`} />
          <div className="grid grid-cols-2 gap-2">
            <input name="phone" defaultValue={current.phone ?? ""} maxLength={32} inputMode="tel" placeholder="Phone" aria-label="Agent phone" className={`${inputClass} text-xs`} />
            <input name="whatsapp" defaultValue={current.whatsapp ?? ""} maxLength={32} inputMode="tel" placeholder="WhatsApp" aria-label="Agent WhatsApp" className={`${inputClass} text-xs`} />
          </div>
          <button type="submit" className={ghost} disabled={busy}>{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}Save agent card</button>
        </form>}
      </>}
  </div>;
}

// --- Approved brand details (owners and administrators) ----------------------------------

/**
 * The approved company details pages use: contacts, office and the marketing
 * disclaimer. The same brand settings as Content Studio; fields not shown
 * here are sent back unchanged. Company phone and email come from the
 * company profile and are only switched on here.
 */
export function BrandDetailsForm({focus, onSaved, onCancel, compact = false}: {focus?: "contacts" | "disclaimer"; onSaved?: () => void; onCancel?: () => void; compact?: boolean}) {
  const {organizationId, refresh} = useEditorServices();
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getBrandSettings().then(data => { if (active) setBrand(data); }, failure => { if (active) setError(errorMessage(failure, "Brand settings could not be loaded.")); });
    return () => { active = false; };
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brand) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const profile = brand.profile;
    setBusy(true); setError(null);
    try {
      await saveBrandSettings(organizationId, {
        expectedRevision: profile?.revision ?? 0, displayName: profile?.displayName ?? "", logoReference: profile?.logoReference ?? "", brandTone: profile?.brandTone ?? "",
        preferredLanguage: profile?.preferredLanguage ?? "EN", defaultCallToAction: profile?.defaultCallToAction ?? "", tagline: profile?.tagline ?? "",
        marketingDisclaimer: text("marketingDisclaimer"),
        useCompanyPhone: form.get("useCompanyPhone") === "on", useCompanyEmail: form.get("useCompanyEmail") === "on",
        whatsappNumber: text("whatsappNumber"), website: text("website"), officeAddress: text("officeAddress"), officeHours: text("officeHours"),
      });
      await refresh();
      toast.success("Brand details saved. The checklist has been re-checked.");
      onSaved?.();
    } catch (failure) { setError(errorMessage(failure, "Brand details could not be saved.")); } finally { setBusy(false); }
  };
  const label = compact ? "block space-y-1 text-xs text-zinc-300" : "block space-y-1 text-sm";
  const field = compact ? `${inputClass} h-8 text-xs` : inputClass;
  if (!brand && !error) return <p className="flex items-center gap-2 text-xs text-zinc-400"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Loading brand details…</p>;
  if (!brand) return <p role="alert" className="text-xs text-red-300">{error}</p>;
  const noCompanyContact = !brand.organization.contactPhone && !brand.organization.companyEmail;
  const contacts = <>
    <label className="flex items-center justify-between gap-3 text-sm"><span className={compact ? "text-xs" : ""}>Show company phone<span className="block text-[11px] text-zinc-500">{brand.organization.contactPhone ?? "No phone on the company profile"}</span></span>
      <input type="checkbox" name="useCompanyPhone" defaultChecked={brand.profile?.useCompanyPhone ?? false} disabled={!brand.organization.contactPhone} className="size-4 accent-sky-500" /></label>
    <label className="flex items-center justify-between gap-3 text-sm"><span className={compact ? "text-xs" : ""}>Show company email<span className="block text-[11px] text-zinc-500">{brand.organization.companyEmail ?? "No email on the company profile"}</span></span>
      <input type="checkbox" name="useCompanyEmail" defaultChecked={brand.profile?.useCompanyEmail ?? false} disabled={!brand.organization.companyEmail} className="size-4 accent-sky-500" /></label>
    {noCompanyContact && <p className="text-[11px] leading-4 text-zinc-400">The company profile has no phone or email. Add a WhatsApp number below, or <a href="/settings/company" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-300 hover:underline">add them in Company settings<ExternalLink className="size-3" aria-hidden="true" /></a>, then re-check.</p>}
    <label className={label}>WhatsApp number<input name="whatsappNumber" inputMode="tel" maxLength={32} defaultValue={brand.profile?.whatsappNumber ?? ""} placeholder="+971 50 000 0000" className={field} /></label>
  </>;
  const disclaimer = <label className={label}>Marketing disclaimer<textarea name="marketingDisclaimer" maxLength={1000} defaultValue={brand.profile?.marketingDisclaimer ?? ""} autoFocus={focus === "disclaimer"}
    placeholder="Images are for illustration only. Prices, payment plans and availability are subject to change without notice…" className={`${textareaClass} ${compact ? "min-h-20 text-xs" : ""}`} />
    <span className="block text-[11px] text-zinc-500">Shown in the footer of every page unless a page sets its own.</span></label>;
  // Fields that are not the focus stay in the form (hidden) so their saved values are kept.
  const hiddenField = (name: string, value: string | null | undefined) => <input type="hidden" name={name} defaultValue={value ?? ""} />;
  return <form onSubmit={submit} className={compact ? "space-y-3" : "space-y-4"} aria-label="Brand details">
    {focus === "disclaimer" ? <>
      {disclaimer}
      {hiddenField("whatsappNumber", brand.profile?.whatsappNumber)}{hiddenField("website", brand.profile?.website)}{hiddenField("officeAddress", brand.profile?.officeAddress)}{hiddenField("officeHours", brand.profile?.officeHours)}
      {brand.profile?.useCompanyPhone && <input type="hidden" name="useCompanyPhone" value="on" />}{brand.profile?.useCompanyEmail && <input type="hidden" name="useCompanyEmail" value="on" />}
    </> : focus === "contacts" ? <>
      {contacts}
      {hiddenField("website", brand.profile?.website)}{hiddenField("officeAddress", brand.profile?.officeAddress)}{hiddenField("officeHours", brand.profile?.officeHours)}{hiddenField("marketingDisclaimer", brand.profile?.marketingDisclaimer)}
    </> : <>
      {contacts}
      <label className={label}>Website (https)<input name="website" type="url" maxLength={2048} defaultValue={brand.profile?.website ?? ""} placeholder="https://www.your-agency.ae" className={field} /></label>
      <label className={label}>Office address<input name="officeAddress" maxLength={300} defaultValue={brand.profile?.officeAddress ?? ""} placeholder="Office 1201, Example Tower, Business Bay, Dubai" className={field} /></label>
      <label className={label}>Office hours<input name="officeHours" maxLength={200} defaultValue={brand.profile?.officeHours ?? ""} placeholder="Mon–Sat, 9:00–18:00" className={field} /></label>
      {disclaimer}
    </>}
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    <div className="flex justify-end gap-2">{onCancel && <button type="button" className={ghost} onClick={onCancel}>Cancel</button>}
      <button type="submit" className={primary} disabled={busy}>{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}Approve and save</button></div>
  </form>;
}

export function BrandContactsDrawer({onClose}: {onClose: () => void}) {
  return <div className="fixed inset-0 z-[70] flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-labelledby="brand-drawer-title" onClick={onClose}>
    <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="mb-4 flex items-center justify-between"><h2 id="brand-drawer-title" className="text-base font-semibold">Company contacts</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-4" /></button></div>
      <p className="mb-4 text-xs leading-5 text-zinc-400">These approved details are used on every page and in Content Studio. Company phone and email come from the company profile; switch them on to show them.</p>
      <BrandDetailsForm onSaved={onClose} onCancel={onClose} />
    </div>
  </div>;
}
