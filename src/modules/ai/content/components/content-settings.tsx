"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FileText, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CONTENT_CATALOG, CONTENT_LANGUAGES, CONTENT_TONES, CONTENT_TYPES, LANGUAGE_LABELS, TONE_LABELS, type ContentLanguage, type ContentType,
} from "../catalog";
import {
  createTemplate, deleteTemplate, getBrandSettings, listTemplates, saveBrandSettings, updateTemplate, type BrandSettings, type ContentTemplate,
} from "../client";
import { textareaClass } from "./content-fields";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60";

/** Starting points for the reusable templates the brief asks for; administrators edit them before saving. */
const STARTER_TEMPLATES: Array<{name: string; contentType: ContentType; purpose?: string; instructions: string}> = [
  {name: "Property description", contentType: "PROPERTY_DESCRIPTION", instructions: "Open with the property type, bedrooms and community. Short paragraphs. End with a clear invitation to arrange a viewing."},
  {name: "New project announcement", contentType: "SOCIAL_MEDIA", purpose: "PROJECT_UPDATE", instructions: "Lead with the project name and developer. Mention recorded handover timing and unit types only. Five to eight hashtags."},
  {name: "Lead introduction", contentType: "WHATSAPP_MESSAGE", purpose: "NEW_LEAD_INTRODUCTION", instructions: "Introduce yourself and the agency in one sentence, confirm what the customer is looking for, and ask one simple question."},
  {name: "WhatsApp follow-up", contentType: "WHATSAPP_MESSAGE", purpose: "ENQUIRY_FOLLOW_UP", instructions: "Friendly, under 60 words, one question that moves the enquiry forward."},
  {name: "Viewing confirmation", contentType: "WHATSAPP_MESSAGE", purpose: "VIEWING_CONFIRMATION", instructions: "State the viewing date, time and property reference exactly as recorded and ask the customer to confirm."},
  {name: "Email marketing", contentType: "EMAIL", purpose: "PROJECT_LAUNCH", instructions: "Subject under 60 characters. Three short paragraphs and one call to action."},
  {name: "Social media post", contentType: "SOCIAL_MEDIA", purpose: "PROPERTY_ANNOUNCEMENT", instructions: "Hook in the first line, key facts as short lines, close with the call to action."},
];

interface TemplateForm { id?: string; expectedRevision?: number; name: string; contentType: ContentType; purpose: string; instructions: string; tone: string; language: string; isActive: boolean }

const emptyTemplate = (): TemplateForm => ({name: "", contentType: "PROPERTY_DESCRIPTION", purpose: "", instructions: "", tone: "", language: "", isActive: true});

export function ContentSettings({organizationId}: {organizationId: string}) {
  const [brand, setBrand] = useState<BrandSettings | null>(null);
  const [brandError, setBrandError] = useState<string | null>(null);
  const [savingBrand, setSavingBrand] = useState(false);
  const [templates, setTemplates] = useState<ContentTemplate[] | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TemplateForm | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deleting, setDeleting] = useState<ContentTemplate | null>(null);

  const loadBrand = useCallback(() => getBrandSettings().then(result => { setBrand(result); setBrandError(null); })
    .catch(error => setBrandError(error instanceof Error ? error.message : "Brand settings could not be loaded.")), []);
  const loadTemplates = useCallback(() => listTemplates({includeInactive: true}).then(result => { setTemplates(result.templates); setTemplatesError(null); })
    .catch(error => setTemplatesError(error instanceof Error ? error.message : "Templates could not be loaded.")), []);
  useEffect(() => { void loadBrand(); void loadTemplates(); }, [loadBrand, loadTemplates]);

  const canEdit = brand?.canEdit ?? false;

  const submitBrand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brand) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    setSavingBrand(true);
    try {
      const result = await saveBrandSettings(organizationId, {
        expectedRevision: brand.profile?.revision ?? 0,
        displayName: text("displayName"), logoReference: text("logoReference"), brandTone: text("brandTone"), preferredLanguage: text("preferredLanguage"),
        useCompanyPhone: form.get("useCompanyPhone") === "on", useCompanyEmail: form.get("useCompanyEmail") === "on",
        website: text("website"), whatsappNumber: text("whatsappNumber"), defaultCallToAction: text("defaultCallToAction"), tagline: text("tagline"),
        marketingDisclaimer: text("marketingDisclaimer"),
      });
      setBrand(result);
      toast.success("Brand settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand settings could not be saved.");
      void loadBrand();
    } finally { setSavingBrand(false); }
  };

  const submitTemplate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setSavingTemplate(true);
    const body = {
      name: editing.name.trim(), contentType: editing.contentType, purpose: editing.purpose || undefined, instructions: editing.instructions.trim(),
      tone: editing.tone || undefined, language: editing.language || undefined, isActive: editing.isActive,
    };
    try {
      if (editing.id) await updateTemplate(editing.id, organizationId, {...body, expectedRevision: editing.expectedRevision});
      else await createTemplate(organizationId, body);
      toast.success("Template saved.");
      setEditing(null);
      void loadTemplates();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The template could not be saved.");
    } finally { setSavingTemplate(false); }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTemplate(deleting.id, organizationId);
      toast.success("Template deleted.");
      setDeleting(null);
      void loadTemplates();
    } catch (error) { toast.error(error instanceof Error ? error.message : "The template could not be deleted."); }
  };

  const profile = brand?.profile;
  return <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle>Brand for AI content</CardTitle>
        <CardDescription>Details the Content Studio may use in drafts. Only details you approve here are used; licence numbers, permits and guarantees are never invented.</CardDescription>
      </CardHeader>
      <CardContent>
        {brandError && <div role="alert" className="text-sm text-destructive">{brandError} <Button variant="link" size="sm" onClick={() => void loadBrand()}>Retry</Button></div>}
        {!brand && !brandError && <div className="space-y-3" aria-busy="true"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-24" /></div>}
        {brand && <form key={profile?.revision ?? 0} className="grid gap-4 sm:grid-cols-2" onSubmit={event => void submitBrand(event)}>
          {!canEdit && <p className="text-sm text-muted-foreground sm:col-span-2">Only owners and administrators can change these settings.</p>}
          <div className="space-y-1.5"><Label htmlFor="brand-display-name">Display name</Label><Input id="brand-display-name" name="displayName" maxLength={160} disabled={!canEdit} defaultValue={profile?.displayName ?? ""} placeholder={brand.organization.name} /></div>
          <div className="space-y-1.5"><Label htmlFor="brand-tagline">Approved tagline</Label><Input id="brand-tagline" name="tagline" maxLength={160} disabled={!canEdit} defaultValue={profile?.tagline ?? ""} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="brand-tone">Brand tone</Label><textarea id="brand-tone" name="brandTone" className={cn(textareaClass, "min-h-16")} maxLength={400} disabled={!canEdit} defaultValue={profile?.brandTone ?? ""} placeholder="For example: warm, professional, no hype" /></div>
          <div className="space-y-1.5"><Label htmlFor="brand-language">Preferred content language</Label>
            <select id="brand-language" name="preferredLanguage" className={selectClass} disabled={!canEdit} defaultValue={profile?.preferredLanguage ?? "EN"}>{CONTENT_LANGUAGES.map(item => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="brand-cta">Default call to action</Label><Input id="brand-cta" name="defaultCallToAction" maxLength={200} disabled={!canEdit} defaultValue={profile?.defaultCallToAction ?? ""} placeholder="Contact us to arrange a viewing" /></div>
          <fieldset className="space-y-2 rounded-lg border p-3 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">Approved contact details</legend>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="useCompanyPhone" className="size-4" disabled={!canEdit || !brand.organization.contactPhone} defaultChecked={profile?.useCompanyPhone ?? false} />Use the company phone{brand.organization.contactPhone ? ` (${brand.organization.contactPhone})` : " (not set in Company settings)"}</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="useCompanyEmail" className="size-4" disabled={!canEdit || !brand.organization.companyEmail} defaultChecked={profile?.useCompanyEmail ?? false} />Use the company email{brand.organization.companyEmail ? ` (${brand.organization.companyEmail})` : " (not set in Company settings)"}</label>
            <div className="grid gap-3 pt-1 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="brand-whatsapp">WhatsApp number</Label><Input id="brand-whatsapp" name="whatsappNumber" inputMode="tel" maxLength={32} disabled={!canEdit} defaultValue={profile?.whatsappNumber ?? ""} placeholder="+971 50 000 0000" /></div>
              <div className="space-y-1.5"><Label htmlFor="brand-website">Website</Label><Input id="brand-website" name="website" type="url" maxLength={2048} disabled={!canEdit} defaultValue={profile?.website ?? ""} placeholder="https://" /></div>
            </div>
          </fieldset>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="brand-logo">Logo reference (https URL)</Label><Input id="brand-logo" name="logoReference" type="url" maxLength={2048} disabled={!canEdit} defaultValue={profile?.logoReference ?? ""} placeholder="https://" />
            <p className="text-xs text-muted-foreground">Stored for future branded exports. It is not sent to Claude.</p></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="brand-disclaimer">Marketing disclaimer</Label><textarea id="brand-disclaimer" name="marketingDisclaimer" className={cn(textareaClass, "min-h-16")} maxLength={1000} disabled={!canEdit} defaultValue={profile?.marketingDisclaimer ?? ""} placeholder="Wording approved by your company, if any" /></div>
          {canEdit && <div className="flex items-center justify-between gap-3 sm:col-span-2">
            <p className="text-xs text-muted-foreground">{profile ? `Last updated ${new Date(profile.updatedAt).toLocaleString("en-AE")}${profile.updatedBy ? ` by ${profile.updatedBy}` : ""}.` : "Not configured yet."}</p>
            <Button type="submit" disabled={savingBrand}>{savingBrand ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save brand settings</Button>
          </div>}
        </form>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div><CardTitle>Content templates</CardTitle><CardDescription>Company style guidance members can pick in the Content Studio. Templates shape tone and structure; they cannot add facts. They are private to this company.</CardDescription></div>
        {canEdit && <Button size="sm" onClick={() => setEditing(emptyTemplate())}><Plus className="size-4" />New template</Button>}
      </CardHeader>
      <CardContent className="space-y-3">
        {templatesError && <div role="alert" className="text-sm text-destructive">{templatesError} <Button variant="link" size="sm" onClick={() => void loadTemplates()}>Retry</Button></div>}
        {!templates && !templatesError && <div className="space-y-2" aria-busy="true"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>}
        {templates?.length === 0 && <EmptyState icon={FileText} title="No templates yet" description={canEdit ? "Start from a suggested template below or create your own." : "Your administrators have not added templates."} />}
        {templates && templates.length > 0 && <ul className="divide-y rounded-lg border">{templates.map(template => <li key={template.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
          <span className="min-w-0"><span className="font-medium">{template.name}</span>
            <span className="block text-xs text-muted-foreground">{CONTENT_CATALOG[template.contentType].label}{template.purpose ? ` · ${CONTENT_CATALOG[template.contentType].purposes[template.purpose]?.label ?? template.purpose}` : " · Any purpose"}</span></span>
          <span className="flex items-center gap-2">{!template.isActive && <Badge variant="outline">Inactive</Badge>}
            {canEdit && <><Button variant="ghost" size="sm" onClick={() => setEditing({id: template.id, expectedRevision: template.revision, name: template.name, contentType: template.contentType, purpose: template.purpose ?? "", instructions: template.instructions, tone: template.tone ?? "", language: template.language ?? "", isActive: template.isActive})}><Pencil className="size-4" />Edit</Button>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleting(template)}><Trash2 className="size-4" />Delete</Button></>}</span>
        </li>)}</ul>}
        {canEdit && templates && <div className="space-y-2 pt-2"><p className="text-xs font-medium text-muted-foreground">Suggested starting points</p>
          <div className="flex flex-wrap gap-2">{STARTER_TEMPLATES.filter(starter => !templates.some(template => template.name === starter.name)).map(starter =>
            <Button key={starter.name} variant="outline" size="sm" onClick={() => setEditing({...emptyTemplate(), name: starter.name, contentType: starter.contentType, purpose: starter.purpose ?? "", instructions: starter.instructions})}><Plus className="size-4" />{starter.name}</Button>)}</div></div>}
      </CardContent>
    </Card>

    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}>
      <DialogContent className="sm:max-w-lg">
        {editing && <form onSubmit={event => void submitTemplate(event)} className="space-y-4">
          <DialogHeader><DialogTitle>{editing.id ? "Edit template" : "New template"}</DialogTitle><DialogDescription>Style and structure guidance only. Facts always come from the CRM.</DialogDescription></DialogHeader>
          <div className="space-y-1.5"><Label htmlFor="template-name">Name</Label><Input id="template-name" required minLength={2} maxLength={120} value={editing.name} onChange={event => setEditing({...editing, name: event.target.value})} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="template-type">Content type</Label>
              <select id="template-type" className={selectClass} value={editing.contentType} onChange={event => setEditing({...editing, contentType: event.target.value as ContentType, purpose: ""})}>{CONTENT_TYPES.map(item => <option key={item} value={item}>{CONTENT_CATALOG[item].label}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="template-purpose">Purpose</Label>
              <select id="template-purpose" className={selectClass} value={editing.purpose} onChange={event => setEditing({...editing, purpose: event.target.value})}><option value="">Any purpose</option>{Object.entries(CONTENT_CATALOG[editing.contentType].purposes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="template-tone">Suggested tone</Label>
              <select id="template-tone" className={selectClass} value={editing.tone} onChange={event => setEditing({...editing, tone: event.target.value})}><option value="">Any</option>{CONTENT_TONES.map(item => <option key={item} value={item}>{TONE_LABELS[item]}</option>)}</select></div>
            <div className="space-y-1.5"><Label htmlFor="template-language">Suggested language</Label>
              <select id="template-language" className={selectClass} value={editing.language} onChange={event => setEditing({...editing, language: event.target.value as ContentLanguage | ""})}><option value="">Any</option>{CONTENT_LANGUAGES.map(item => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}</select></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="template-instructions">Instructions</Label><textarea id="template-instructions" required className={cn(textareaClass, "min-h-32")} maxLength={2000} value={editing.instructions} onChange={event => setEditing({...editing, instructions: event.target.value})} />
            <p className="text-xs text-muted-foreground">{editing.instructions.length}/2000</p></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={editing.isActive} onChange={event => setEditing({...editing, isActive: event.target.checked})} />Available to members</label>
          <DialogFooter className="gap-2"><Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={savingTemplate}>{savingTemplate && <Loader2 className="size-4 animate-spin" />}Save template</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(deleting)} onOpenChange={open => { if (!open) setDeleting(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete template?</DialogTitle><DialogDescription>{deleting?.name} will no longer be available. Existing drafts are not changed.</DialogDescription></DialogHeader>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" onClick={() => void confirmDelete()}>Delete</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
