"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, FilePlus2, FileText, History, Loader2, Search, Sparkles, Square, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  AUDIENCE_LABELS, CONTENT_AUDIENCES, CONTENT_CATALOG, CONTENT_LANGUAGES, CONTENT_LENGTHS, CONTENT_TONES, CONTENT_TYPES, LANGUAGE_LABELS, LENGTH_LABELS,
  MAX_PROPOSAL_LISTINGS, STATUS_LABELS, TONE_LABELS, purposeFor, sourceProblem,
  type ContentAudience, type ContentLanguage, type ContentLength, type ContentTone, type ContentType, type SourceKind,
} from "../catalog";
import {
  ContentRequestError, generatePath, getStudioStatus, listDrafts, listSourceOptions, listTemplates, regeneratePath, streamGeneration,
  type ContentTemplate, type DraftDetail, type DraftSummary, type SourceOption, type StudioStatus,
} from "../client";
import { DraftEditor, statusVariant, type GenerationRequest } from "./draft-editor";
import { textareaClass } from "./content-fields";
import { SourcePicker } from "./source-picker";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:opacity-60";

export interface StudioInitial {
  contentType?: ContentType; purpose?: string; propertyId?: string; listingId?: string; projectId?: string; leadId?: string; draftId?: string;
}

type Selections = Record<SourceKind, SourceOption[]> & {listings: SourceOption[]};
const EMPTY_SELECTIONS: Selections = {property: [], listing: [], project: [], lead: [], listings: []};

interface GenerationState { mode: "GENERATE" | "REGENERATE" | "ALTERNATIVE"; stage: "starting" | "writing" | "checking" | "saving"; characters: number; controller: AbortController }

const STAGES: Array<{id: GenerationState["stage"]; label: string}> = [
  {id: "starting", label: "Checking your access to the selected records"},
  {id: "writing", label: "Claude is writing from verified CRM facts"},
  {id: "checking", label: "Checking figures, contacts and claims"},
  {id: "saving", label: "Saving the draft"},
];

const relative = (value: string) => {
  const date = new Date(value);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days < 1) return date.toLocaleTimeString("en-AE", {hour: "2-digit", minute: "2-digit"});
  if (days < 7) return date.toLocaleDateString("en-AE", {weekday: "short"});
  return date.toLocaleDateString("en-AE", {day: "numeric", month: "short"});
};

function firstPurpose(type: ContentType) { return Object.keys(CONTENT_CATALOG[type].purposes)[0]; }

export function ContentStudio({organizationId, companyName, initial}: {organizationId: string; companyName: string; initial: StudioInitial}) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<StudioStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [panel, setPanel] = useState<"new" | "drafts">(initial.draftId ? "drafts" : "new");

  // Generator form
  const [type, setType] = useState<ContentType>(initial.contentType ?? "PROPERTY_DESCRIPTION");
  const [purpose, setPurpose] = useState<string>(initial.contentType && initial.purpose && purposeFor(initial.contentType, initial.purpose) ? initial.purpose : firstPurpose(initial.contentType ?? "PROPERTY_DESCRIPTION"));
  const [language, setLanguage] = useState<ContentLanguage>("EN");
  const [tone, setTone] = useState<ContentTone>("PROFESSIONAL");
  const [audience, setAudience] = useState<ContentAudience>("GENERAL");
  const [length, setLength] = useState<ContentLength>("STANDARD");
  const [instructions, setInstructions] = useState("");
  const [useFirstName, setUseFirstName] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);

  // Drafts
  const [drafts, setDrafts] = useState<DraftSummary[] | null>(null);
  const [draftsError, setDraftsError] = useState<string | null>(null);
  const [draftTotal, setDraftTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [canViewCompany, setCanViewCompany] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("ACTIVE");
  const [scope, setScope] = useState<"MINE" | "COMPANY">("MINE");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(initial.draftId ?? null);
  const [reloadKey, setReloadKey] = useState(0);
  const dirtyRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const [generation, setGeneration] = useState<GenerationState | null>(null);
  const [generationError, setGenerationError] = useState<{code: string; message: string; retryable: boolean} | null>(null);
  const [lastRequest, setLastRequest] = useState<{path: string; body: unknown; mode: GenerationState["mode"]} | null>(null);

  const loadStatus = useCallback(() => getStudioStatus().then(result => { setStatus(result); setStatusError(null); })
    .catch(error => setStatusError(error instanceof Error ? error.message : "The Content Studio could not be loaded.")), []);
  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const loadDrafts = useCallback((offset = 0) => listDrafts({search, view, scope, offset}).then(result => {
    setDrafts(current => offset ? [...(current ?? []), ...result.drafts] : result.drafts);
    setDraftTotal(result.total);
    setHasMore(result.hasNext);
    setCanViewCompany(result.canViewCompany);
    setDraftsError(null);
  }).catch(error => setDraftsError(error instanceof Error ? error.message : "Drafts could not be loaded.")), [search, view, scope]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadDrafts(0); }, 250);
    return () => clearTimeout(timer);
  }, [loadDrafts]);

  // Pre-select records passed from a CRM page. Each ID is checked against the caller's access first.
  useEffect(() => {
    const entries = ([["property", initial.propertyId], ["listing", initial.listingId], ["project", initial.projectId], ["lead", initial.leadId]] as const)
      .filter((entry): entry is readonly [SourceKind, string] => Boolean(entry[1]));
    if (!entries.length) return;
    let cancelled = false;
    void Promise.allSettled(entries.map(([kind, id]) => listSourceOptions(kind, {id}).then(result => ({kind, option: result.options[0]})))).then(results => {
      if (cancelled) return;
      const next: Selections = {...EMPTY_SELECTIONS};
      let failed = 0;
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.option) next[result.value.kind] = [result.value.option];
        else failed += 1;
      }
      setSelections(next);
      if (failed) setPrefillNotice("A record from the page you came from is unavailable or outside the records you can use, so it was not selected.");
    });
    return () => { cancelled = true; };
  }, [initial.propertyId, initial.listingId, initial.projectId, initial.leadId]);

  useEffect(() => {
    let cancelled = false;
    listTemplates({contentType: type}).then(result => { if (!cancelled) setTemplates(result.templates); }).catch(() => { if (!cancelled) setTemplates([]); });
    return () => { cancelled = true; };
  }, [type]);

  const rule = useMemo(() => purposeFor(type, purpose)?.sources ?? {allowed: [] as SourceKind[]}, [type, purpose]);
  const selection = useMemo(() => ({
    propertyId: rule.allowed.includes("property") ? selections.property[0]?.id : undefined,
    listingId: rule.allowed.includes("listing") && !rule.listings ? selections.listing[0]?.id : undefined,
    projectId: rule.allowed.includes("project") ? selections.project[0]?.id : undefined,
    leadId: rule.allowed.includes("lead") ? selections.lead[0]?.id : undefined,
    listingIds: rule.listings ? selections.listings.map(item => item.id) : undefined,
  }), [rule, selections]);
  const problem = sourceProblem(type, purpose, selection);
  const enabled = status?.enabled === true;
  const hasInventory = status?.hasInventoryAccess !== false;
  const usableTemplates = templates.filter(template => !template.purpose || template.purpose === purpose);

  const selectDraft = (id: string | null) => {
    if (id === activeDraftId) return;
    if (dirtyRef.current && !window.confirm("You have unsaved edits in this draft. Leave without saving?")) return;
    dirtyRef.current = false;
    setActiveDraftId(id);
    setGenerationError(null);
    router.replace(id ? `${pathname}?draft=${encodeURIComponent(id)}` : pathname, {scroll: false});
    if (id) setTimeout(() => editorRef.current?.scrollIntoView({behavior: "smooth", block: "start"}), 50);
  };

  const run = async (path: string, body: unknown, mode: GenerationState["mode"]) => {
    const controller = new AbortController();
    setLastRequest({path, body, mode});
    setGeneration({mode, stage: "starting", characters: 0, controller});
    setGenerationError(null);
    let doneDraft: string | null = null;
    try {
      await streamGeneration({path, organizationId, body, signal: controller.signal, onEvent: event => {
        if (event.type === "stage") setGeneration(current => current ? {...current, stage: event.stage} : current);
        else if (event.type === "progress") setGeneration(current => current ? {...current, characters: event.characters} : current);
        else if (event.type === "done") doneDraft = event.draftId;
        else if (event.type === "error") setGenerationError({code: event.code, message: event.message, retryable: event.retryable});
      }});
    } catch (error) {
      if (controller.signal.aborted) setGenerationError({code: "AI_CANCELLED", message: "Generation was stopped. Nothing was saved.", retryable: true});
      else setGenerationError({code: error instanceof ContentRequestError ? error.code : "ERROR", message: error instanceof Error ? error.message : "The draft could not be generated.",
        retryable: !(error instanceof ContentRequestError) || ![400, 401, 403, 404].includes(error.status)});
    } finally {
      setGeneration(null);
      void loadStatus();
    }
    if (doneDraft) {
      toast.success(mode === "ALTERNATIVE" ? "Alternative added to the version history." : "Draft generated and saved.");
      dirtyRef.current = false;
      if (doneDraft === activeDraftId) setReloadKey(key => key + 1);
      else selectDraft(doneDraft);
      setPanel("drafts");
      void loadDrafts(0);
    }
  };

  const generate = () => {
    if (problem || !enabled) return;
    void run(generatePath, {
      contentType: type, purpose, language, tone, audience, length, useLeadFirstName: useFirstName,
      ...(instructions.trim() ? {customInstructions: instructions.trim()} : {}), ...(templateId ? {templateId} : {}),
      ...Object.fromEntries(Object.entries(selection).filter(([, value]) => value !== undefined)),
    }, "GENERATE");
  };

  const regenerate = (request: GenerationRequest, draft: DraftDetail) => {
    void run(regeneratePath(draft.id), {mode: request.mode, expectedRevision: draft.revision, ...(request.customInstructions ? {customInstructions: request.customInstructions} : {}), ...(request.length ? {length: request.length} : {})}, request.mode);
  };

  const changeType = (next: ContentType) => {
    setType(next);
    setPurpose(firstPurpose(next));
    setTemplateId("");
  };

  const pick = (kind: keyof Selections) => (options: SourceOption[]) => setSelections(current => ({...current, [kind]: options}));
  const limit = (scopeUsage: {used: number; limit: number}) => `${scopeUsage.used.toLocaleString("en-US")} / ${scopeUsage.limit.toLocaleString("en-US")}`;
  const busy = Boolean(generation);

  return <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
    <aside className="space-y-4" aria-label="Content Studio controls">
      {statusError && <div role="alert" className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 text-destructive" /><span>{statusError}</span></div>}
      {status && !status.enabled && <div role="status" className="flex gap-2 rounded-xl border bg-muted/40 p-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{status.message} Saved drafts remain available.</span></div>}
      {status?.enabled && <p className="text-xs text-muted-foreground">AI requests this month (Copilot and Content Studio): you {limit(status.usage.user)} · company {limit(status.usage.organization)}. Model: {status.model}.</p>}

      <div className="inline-flex w-full rounded-lg border p-0.5" role="tablist" aria-label="Studio panels">
        <Button role="tab" aria-selected={panel === "new"} variant={panel === "new" ? "secondary" : "ghost"} size="sm" className="flex-1" onClick={() => setPanel("new")}><FilePlus2 className="size-4" />New draft</Button>
        <Button role="tab" aria-selected={panel === "drafts"} variant={panel === "drafts" ? "secondary" : "ghost"} size="sm" className="flex-1" onClick={() => setPanel("drafts")}><History className="size-4" />Drafts{draftTotal ? ` (${draftTotal})` : ""}</Button>
      </div>

      {panel === "new" ? <form className="space-y-4 rounded-xl border bg-card p-4" onSubmit={event => { event.preventDefault(); generate(); }} aria-label="Generate a draft">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Content type</legend>
          <div className="grid grid-cols-2 gap-2">
            {CONTENT_TYPES.map(item => {
              const unavailable = CONTENT_CATALOG[item].needsInventory && !hasInventory;
              return <label key={item} className={cn("cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50", type === item ? "border-primary bg-primary/5 font-medium" : "hover:bg-muted", unavailable && "cursor-not-allowed opacity-50")}>
                <input type="radio" name="contentType" value={item} className="sr-only" checked={type === item} disabled={unavailable || busy} onChange={() => changeType(item)} />
                {CONTENT_CATALOG[item].label}
              </label>;
            })}
          </div>
          <p className="text-xs text-muted-foreground">{CONTENT_CATALOG[type].description}</p>
        </fieldset>

        <div className="space-y-1.5"><Label htmlFor="content-purpose">Purpose</Label>
          <select id="content-purpose" className={selectClass} value={purpose} disabled={busy} onChange={event => { setPurpose(event.target.value); setTemplateId(""); }}>
            {Object.entries(CONTENT_CATALOG[type].purposes).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select></div>

        {prefillNotice && <p role="status" className="rounded-lg border bg-muted/40 p-2 text-xs">{prefillNotice}</p>}
        {rule.listings
          ? <SourcePicker kind="listing" max={MAX_PROPOSAL_LISTINGS} label="Listings" selected={selections.listings} onChange={pick("listings")} disabled={busy} hint="Only listings you are permitted to use appear here." />
          : <>
            {rule.allowed.includes("listing") && <SourcePicker kind="listing" selected={selections.listing} onChange={pick("listing")} disabled={busy} />}
            {rule.allowed.includes("property") && <SourcePicker kind="property" selected={selections.property} onChange={pick("property")} disabled={busy} hint={rule.allowed.includes("listing") ? "Choose a listing for its asking price, or a property unit." : undefined} />}
            {rule.allowed.includes("project") && <SourcePicker kind="project" selected={selections.project} onChange={pick("project")} disabled={busy} />}
          </>}
        {rule.allowed.includes("lead") && <div className="space-y-2">
          <SourcePicker kind="lead" label={rule.lead ? "Lead" : "Lead (optional)"} selected={selections.lead} onChange={pick("lead")} disabled={busy} hint="Only leads you can open in EstateOS. Contact details, budget and notes are never sent to Claude." />
          {selections.lead.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={useFirstName} disabled={busy} onChange={event => setUseFirstName(event.target.checked)} />Address the customer by first name</label>}
        </div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="content-language">Language</Label>
            <select id="content-language" className={selectClass} value={language} disabled={busy} onChange={event => setLanguage(event.target.value as ContentLanguage)}>
              {CONTENT_LANGUAGES.map(item => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="content-tone">Tone</Label>
            <select id="content-tone" className={selectClass} value={tone} disabled={busy} onChange={event => setTone(event.target.value as ContentTone)}>
              {CONTENT_TONES.map(item => <option key={item} value={item}>{TONE_LABELS[item]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="content-audience">Audience</Label>
            <select id="content-audience" className={selectClass} value={audience} disabled={busy} onChange={event => setAudience(event.target.value as ContentAudience)}>
              {CONTENT_AUDIENCES.map(item => <option key={item} value={item}>{AUDIENCE_LABELS[item]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="content-length">Length</Label>
            <select id="content-length" className={selectClass} value={length} disabled={busy} onChange={event => setLength(event.target.value as ContentLength)}>
              {CONTENT_LENGTHS.map(item => <option key={item} value={item}>{LENGTH_LABELS[item]}</option>)}</select></div>
        </div>

        {usableTemplates.length > 0 && <div className="space-y-1.5"><Label htmlFor="content-template">Company template</Label>
          <select id="content-template" className={selectClass} value={templateId} disabled={busy} onChange={event => setTemplateId(event.target.value)}>
            <option value="">No template</option>{usableTemplates.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></div>}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><Label htmlFor="content-instructions">Style instructions (optional)</Label><span className="text-xs text-muted-foreground tabular-nums">{instructions.length}/{status?.enabled ? status.maxInstructionsChars : 1500}</span></div>
          <textarea id="content-instructions" className={cn(textareaClass, "min-h-20")} maxLength={status?.enabled ? status.maxInstructionsChars : 1500} value={instructions} disabled={busy}
            placeholder="For example: mention the sea view first, keep it under 100 words" onChange={event => setInstructions(event.target.value)} />
          <p className="text-xs text-muted-foreground">Instructions guide style only; Claude may state only facts recorded in EstateOS.</p>
        </div>

        {problem && <p className="text-xs text-muted-foreground" role="status">{problem}</p>}
        <Button type="submit" className="w-full" disabled={!enabled || Boolean(problem) || busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}Generate draft</Button>
        <p className="text-xs text-muted-foreground">Drafts are saved for you to edit. Nothing is sent, published or changed in the CRM.</p>
      </form> : <section className="space-y-3 rounded-xl border bg-card p-4" aria-label="Saved drafts">
        <div className="relative"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input aria-label="Search drafts by title" className="ps-9" placeholder="Search drafts" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="grid grid-cols-2 gap-2">
          <select aria-label="Draft status" className={selectClass} value={view} onChange={event => setView(event.target.value)}>
            <option value="ACTIVE">All active</option>{(["DRAFT", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const).map(item => <option key={item} value={item}>{STATUS_LABELS[item]}</option>)}</select>
          {canViewCompany && <select aria-label="Whose drafts" className={selectClass} value={scope} onChange={event => setScope(event.target.value as "MINE" | "COMPANY")}>
            <option value="MINE">My drafts</option><option value="COMPANY">Whole company</option></select>}
        </div>
        {draftsError && <div role="alert" className="text-sm text-destructive">{draftsError} <Button variant="link" size="sm" onClick={() => void loadDrafts(0)}>Retry</Button></div>}
        {!drafts && !draftsError && <div className="space-y-2" aria-busy="true"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>}
        {drafts?.length === 0 && <EmptyState icon={FileText} title={search ? "No matching drafts" : "No drafts yet"} description={search ? "Try another search or status." : "Generated drafts are saved here for editing."} />}
        {drafts && drafts.length > 0 && <ul className="space-y-1.5">{drafts.map(draft => <li key={draft.id}>
          <button type="button" onClick={() => selectDraft(draft.id)} aria-current={draft.id === activeDraftId ? "true" : undefined}
            className={cn("w-full rounded-lg border px-3 py-2 text-start text-sm transition-colors hover:bg-muted", draft.id === activeDraftId && "border-primary bg-primary/5")}>
            <span className="block truncate font-medium">{draft.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <Badge variant={statusVariant(draft.status)} className="text-[10px]">{STATUS_LABELS[draft.status]}</Badge>
              {CONTENT_CATALOG[draft.contentType].label} · {LANGUAGE_LABELS[draft.language]} · v{draft.versionCount} · {relative(draft.updatedAt)}{!draft.isMine && draft.createdBy ? ` · ${draft.createdBy}` : ""}
            </span>
          </button>
        </li>)}</ul>}
        {hasMore && <Button variant="outline" size="sm" className="w-full" onClick={() => void loadDrafts(drafts?.length ?? 0)}>Load more</Button>}
      </section>}
    </aside>

    <section ref={editorRef} aria-label="Draft" className="min-w-0 scroll-mt-20">
      {generation && <div role="status" aria-live="polite" className="mb-5 space-y-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="size-4 text-primary" aria-hidden="true" />{generation.mode === "GENERATE" ? "Generating draft" : generation.mode === "ALTERNATIVE" ? "Writing an alternative" : "Regenerating draft"}</p>
          <Button variant="outline" size="sm" onClick={() => generation.controller.abort()}><Square className="size-3.5" />Stop</Button>
        </div>
        <ol className="space-y-1.5 text-sm">{STAGES.map((stage, index) => {
          const current = STAGES.findIndex(item => item.id === generation.stage);
          return <li key={stage.id} className={cn("flex items-center gap-2", index > current && "text-muted-foreground")}>
            {index < current ? <span className="size-4 text-center text-primary">✓</span> : index === current ? <Loader2 className="size-4 animate-spin text-primary" /> : <span className="size-4" />}
            {stage.label}{stage.id === "writing" && index === current && generation.characters > 0 ? ` (${generation.characters.toLocaleString("en-US")} characters)` : ""}
          </li>;
        })}</ol>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{width: `${Math.min(95, 10 + STAGES.findIndex(item => item.id === generation.stage) * 25 + Math.min(20, generation.characters / 300))}%`}} /></div>
      </div>}
      {generationError && !generation && <div role="alert" className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
        <span className="flex gap-2"><AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />{generationError.message}</span>
        {generationError.retryable && lastRequest && <Button variant="outline" size="sm" onClick={() => void run(lastRequest.path, lastRequest.body, lastRequest.mode)}>Try again</Button>}
      </div>}
      {activeDraftId
        ? <DraftEditor key={activeDraftId} draftId={activeDraftId} organizationId={organizationId} companyName={companyName} reloadKey={reloadKey} generating={busy}
          adLimits={status?.enabled ? status.adLimits : null} onGenerate={regenerate} onChanged={() => void loadDrafts(0)}
          onDeleted={() => { dirtyRef.current = false; selectDraft(null); void loadDrafts(0); }}
          onDirtyChange={dirty => { dirtyRef.current = dirty; }} />
        : !generation && <div className="rounded-xl border border-dashed bg-card">
          <EmptyState icon={Wand2} title="Create a draft from your CRM records" description="Choose a content type and the records to write about. Claude writes only from verified EstateOS facts; you review and edit before use." />
        </div>}
    </section>
  </div>;
}
