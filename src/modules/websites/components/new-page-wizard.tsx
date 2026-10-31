"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Copy, FileText, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceOption } from "@/modules/ai/content/client";
import { SourcePicker } from "@/modules/ai/content/components/source-picker";
import { errorMessage, websitesGet, websitesSend } from "../client";
import { MAX_BRIEF_CHARS } from "../policy";
import { DESIGN_STYLES, DESIGN_STYLE_LABELS, slugify, type DesignStyle } from "../registry";
import { PAGE_TEMPLATES, TEMPLATE_KEYS, type TemplateKey } from "../templates";
import type { websitesOverview } from "../server/service";

type Overview = Awaited<ReturnType<typeof websitesOverview>>;
type Mode = "AI" | "TEMPLATE" | "BLANK" | "DUPLICATE";
type SourceKind = "none" | "project" | "listing" | "property";

export interface WizardInitial { mode?: Mode; projectId?: string; listingId?: string; propertyId?: string }

const MODES: Array<{mode: Mode; label: string; description: string; icon: typeof Sparkles}> = [
  {mode: "AI", label: "Describe it to Claude", description: "Claude designs a page from the linked record and your brief.", icon: Sparkles},
  {mode: "TEMPLATE", label: "Start from a template", description: "Eight real estate layouts with linked CRM sections.", icon: LayoutTemplate},
  {mode: "BLANK", label: "Blank page", description: "A hero, an enquiry form and the footer.", icon: FileText},
  {mode: "DUPLICATE", label: "Duplicate a page", description: "Copy one of your existing pages as a new draft.", icon: Copy},
];

export function NewPageWizard({organizationId, initial}: {organizationId: string; initial: WizardInitial}) {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(initial.mode ?? "AI");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [brief, setBrief] = useState("");
  const [style, setStyle] = useState<DesignStyle | "">("");
  const [template, setTemplate] = useState<TemplateKey>("PROJECT_SHOWCASE");
  const [sourceKind, setSourceKind] = useState<SourceKind>(initial.listingId ? "listing" : initial.propertyId ? "property" : initial.projectId ? "project" : "project");
  const [source, setSource] = useState<SourceOption[]>(() => {
    const id = initial.listingId ?? initial.propertyId ?? initial.projectId;
    return id ? [{id, label: "Selected record", detail: "Checked against your permissions when the page is created"}] : [];
  });
  const [duplicateOf, setDuplicateOf] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    websitesGet<Overview>("/api/websites").then(data => {
      setOverview(data);
      if (!data.permissions.canLinkInventory) setSourceKind("none");
      if (data.website.designSettings.defaultStyle) setStyle(data.website.designSettings.defaultStyle as DesignStyle);
    }, failure => setLoadError(errorMessage(failure, "The website builder could not be loaded.")));
  }, []);

  if (loadError) return <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{loadError}</p>;
  if (!overview) return <div className="h-64 animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Loading" />;
  if (!overview.permissions.canCreate) return <p className="rounded-xl border bg-muted/40 p-4 text-sm">Agents can create landing pages only when an owner or administrator allows agent drafts in the website settings.</p>;

  const sourceId = sourceKind === "none" ? null : source[0]?.id ?? null;
  const sources = {projectId: sourceKind === "project" ? sourceId : null, listingId: sourceKind === "listing" ? sourceId : null, propertyId: sourceKind === "property" ? sourceId : null};
  const slugValue = slug.trim() || undefined;
  const ready = title.trim().length > 0 && (mode !== "DUPLICATE" || duplicateOf) && (!slugValue || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slugValue));

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const result = mode === "AI"
        ? await websitesSend<{pageId: string}>("/api/websites/pages/generate", organizationId, "POST", {title: title.trim(), slug: slugValue, brief: brief.trim(), style: style || null, ...sources}, "Claude could not design the page.")
        : await websitesSend<{id: string}>("/api/websites/pages", organizationId, "POST", {
          mode, title: title.trim(), slug: slugValue, ...(mode === "TEMPLATE" ? {templateKey: template} : {}), ...(mode === "DUPLICATE" ? {sourcePageId: duplicateOf} : {}),
          ...(mode === "BLANK" && style ? {style} : {}), ...(mode === "DUPLICATE" ? {} : sources),
        }, "The page could not be created.");
      const pageId = "pageId" in result ? result.pageId : result.id;
      router.push(`/websites/${overview.website.id}/pages/${pageId}/edit`);
    } catch (failure) {
      setError(errorMessage(failure, "The page could not be created."));
      setBusy(false);
    }
  };

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <div className="space-y-6">
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">How do you want to start?</legend>
        <div className="grid gap-3 sm:grid-cols-2">{MODES.map(item => <label key={item.mode} className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${mode === item.mode ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
          <input type="radio" name="mode" value={item.mode} checked={mode === item.mode} onChange={() => setMode(item.mode)} className="sr-only" />
          <item.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" /><span><span className="block font-medium">{item.label}</span><span className="text-muted-foreground">{item.description}</span></span>
        </label>)}</div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="page-title">Page title</Label><Input id="page-title" value={title} maxLength={160} onChange={event => setTitle(event.target.value)} placeholder="Marina Heights launch" /></div>
        <div className="space-y-1.5"><Label htmlFor="page-slug">Page address (optional)</Label><Input id="page-slug" value={slug} maxLength={80} onChange={event => setSlug(event.target.value.toLowerCase())} placeholder={slugify(title || "landing-page")} aria-describedby="slug-hint" />
          <p id="slug-hint" className="text-xs text-muted-foreground">/site/{overview.organization.slug}/{slugValue ?? slugify(title || "landing-page")}</p></div>
      </div>

      {mode === "DUPLICATE" ? <div className="space-y-1.5"><Label htmlFor="duplicate-of">Page to duplicate</Label>
        <select id="duplicate-of" className="h-8 w-full rounded-lg border bg-background px-2 text-sm" value={duplicateOf} onChange={event => setDuplicateOf(event.target.value)}>
          <option value="">Choose a page</option>{overview.pages.map(page => <option key={page.id} value={page.id}>{page.title}</option>)}
        </select><p className="text-xs text-muted-foreground">The copy keeps the original page&apos;s linked record. Photos you cannot access are left out.</p></div>
        : <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-1 text-sm font-medium">Linked CRM record</legend>
          {overview.permissions.canLinkInventory ? <>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Record type">{(["project", "listing", "property", "none"] as const).map(kind => <Button key={kind} type="button" size="sm" variant={sourceKind === kind ? "default" : "outline"} role="radio" aria-checked={sourceKind === kind} onClick={() => { setSourceKind(kind); setSource([]); }}>
              {kind === "none" ? "No record" : kind[0].toUpperCase() + kind.slice(1)}</Button>)}</div>
            {sourceKind !== "none" && <SourcePicker kind={sourceKind} selected={source} onChange={setSource} hint={sourceKind === "property" ? "Properties are advertised through listings. Choose the listing if you plan to publish this page." : "Prices, units, payment plans, photos and the map come from this record."} />}
          </> : <p className="text-sm text-muted-foreground">Your role has no inventory access, so pages you create are not linked to projects or listings. An owner or administrator can link them later.</p>}
        </fieldset>}

      {mode === "TEMPLATE" && <fieldset><legend className="mb-2 text-sm font-medium">Template</legend>
        <div className="grid gap-3 sm:grid-cols-2">{TEMPLATE_KEYS.map(key => <label key={key} className={`cursor-pointer rounded-xl border p-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring ${template === key ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
          <input type="radio" name="template" className="sr-only" checked={template === key} onChange={() => setTemplate(key)} />
          <span className="block font-medium">{PAGE_TEMPLATES[key].name}</span><span className="text-muted-foreground">{PAGE_TEMPLATES[key].description}</span>
          <span className="mt-2 block text-xs text-muted-foreground">{DESIGN_STYLE_LABELS[PAGE_TEMPLATES[key].style]} · best for {PAGE_TEMPLATES[key].bestFor === "any" ? "any page" : `a ${PAGE_TEMPLATES[key].bestFor}`}</span>
        </label>)}</div>
      </fieldset>}

      {(mode === "AI" || mode === "BLANK") && <div className="space-y-1.5"><Label htmlFor="page-style">Design style</Label>
        <select id="page-style" className="h-8 w-full rounded-lg border bg-background px-2 text-sm" value={style} onChange={event => setStyle(event.target.value as DesignStyle | "")}>
          <option value="">{mode === "AI" ? "Let Claude choose" : "Contemporary Real Estate"}</option>{DESIGN_STYLES.map(item => <option key={item} value={item}>{DESIGN_STYLE_LABELS[item]}</option>)}
        </select></div>}

      {mode === "AI" && <div className="space-y-1.5"><Label htmlFor="page-brief">Describe the page</Label>
        <textarea id="page-brief" className="min-h-32 w-full rounded-lg border bg-background px-3 py-2 text-sm" maxLength={MAX_BRIEF_CHARS} value={brief} onChange={event => setBrief(event.target.value)}
          placeholder="A premium modern landing page for our Dubai Marina project with a luxury design, gallery, pricing, map, payment plan and enquiry form." aria-describedby="brief-hint" />
        <p id="brief-hint" className="text-xs text-muted-foreground">{brief.length}/{MAX_BRIEF_CHARS}. Claude uses only the linked record&apos;s facts and your approved brand details; prices, plans, photos and the map are filled from the CRM, never written by Claude. No lead or contact data is sent.</p></div>}

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={!ready || busy}>{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : mode === "AI" ? <Sparkles aria-hidden="true" /> : null}{mode === "AI" ? (busy ? "Claude is designing your page…" : "Generate with Claude") : "Create page"}</Button>
        {busy && mode === "AI" && <p className="text-sm text-muted-foreground" role="status">This usually takes 20–60 seconds. Nothing is saved unless the page passes validation.</p>}
      </div>
    </div>
    <aside className="space-y-3 rounded-xl border bg-muted/30 p-4 text-sm">
      <h2 className="font-semibold">What happens next</h2>
      <ol className="list-decimal space-y-2 ps-4 text-muted-foreground">
        <li>The page opens in the editor as a private draft.</li>
        <li>Edit sections, images, colours and buttons; preview on desktop, tablet and mobile.</li>
        <li>An owner or administrator connects a lead form, reviews the checklist, approves and publishes.</li>
      </ol>
      <p className="text-xs text-muted-foreground">Drafts are never public and are not indexed by search engines.</p>
    </aside>
  </div>;
}
