"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Archive, ArchiveRestore, Check, CheckCircle2, Copy, Eye, FileClock, Loader2, Pencil, RefreshCw, Save, Send, Shuffle, Trash2, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { isAdPlatform, type AdPlatform, type AdPlatformLimits } from "../ad-limits";
import {
  AUDIENCE_LABELS, CONTENT_CATALOG, CONTENT_LENGTHS, LANGUAGE_LABELS, LENGTH_LABELS, STATUS_LABELS, TONE_LABELS, localesFor,
  type ContentAudience, type ContentLength, type ContentLocale, type ContentTone, type DraftStatus,
} from "../catalog";
import {
  ContentRequestError, deleteDraft, getDraft, getVersion, restoreVersion, saveDraft, setDraftStatus,
  type DraftDetail, type VersionSummary,
} from "../client";
import { contentToPlainText, type LocalizedContent } from "../schemas";
import { ContentPreview, FieldsEditor, localeProps, textareaClass } from "./content-fields";

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

const KIND_LABELS: Record<string, string> = {GENERATED: "Generated", REGENERATED: "Regenerated", ALTERNATIVE: "Alternative", EDITED: "Edited", RESTORED: "Restored"};
const WARNING_TITLES: Record<string, string> = {
  UNVERIFIED_NUMBER: "Figures not found in CRM facts", UNVERIFIED_CONTACT: "Contact details not approved", SENSITIVE_CLAIM: "Claims to check",
  LENGTH_LIMIT: "Length limits", PLACEHOLDER: "Placeholders to fill in", MISSING_DATA: "Missing information", MODEL_REVIEW: "Flagged by Claude",
};

export const statusVariant = (status: DraftStatus) => status === "APPROVED" ? "default" as const : status === "ARCHIVED" ? "outline" as const : "secondary" as const;

const formatTime = (value: string | null) => value ? new Date(value).toLocaleString("en-AE", {dateStyle: "medium", timeStyle: "short"}) : "Unknown";

export interface GenerationRequest { mode: "REGENERATE" | "ALTERNATIVE"; customInstructions?: string; length?: ContentLength }

export function DraftEditor({draftId, organizationId, companyName, adLimits, reloadKey, generating, onGenerate, onChanged, onDeleted, onDirtyChange}: {
  draftId: string; organizationId: string; companyName: string; adLimits: Record<AdPlatform, AdPlatformLimits> | null; reloadKey: number; generating: boolean;
  onGenerate: (request: GenerationRequest, draft: DraftDetail) => void; onChanged: () => void; onDeleted: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<DraftDetail | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<LocalizedContent>({});
  const [dirty, setDirty] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("preview");
  const [locale, setLocale] = useState<ContentLocale>("en");
  const [busy, setBusy] = useState<string | null>(null);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [regenerateInstructions, setRegenerateInstructions] = useState("");
  const [regenerateLength, setRegenerateLength] = useState<ContentLength>("STANDARD");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<{versionNumber: number; title: string; kind: string; content: LocalizedContent} | null>(null);
  const [copied, setCopied] = useState(false);

  const apply = useCallback((result: {draft: DraftDetail; versions: VersionSummary[]}) => {
    setDraft(result.draft);
    setVersions(result.versions);
    setTitle(result.draft.title);
    setContent(result.draft.contentData.content);
    setDirty(false);
    setLocale(current => localesFor(result.draft.language).includes(current) ? current : localesFor(result.draft.language)[0]);
    setRegenerateLength(CONTENT_LENGTHS.includes(result.draft.settings.length as ContentLength) ? result.draft.settings.length as ContentLength : "STANDARD");
  }, []);

  const load = useCallback(() => getDraft(draftId).then(result => { apply(result); setLoadError(null); })
    .catch(error => setLoadError(error instanceof Error ? error.message : "This draft could not be loaded.")), [apply, draftId]);

  useEffect(() => { void load(); }, [load, reloadKey]);
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const platform = draft && draft.contentType === "ADVERTISING" && isAdPlatform(draft.purpose) && adLimits ? adLimits[draft.purpose] : null;
  const locales = draft ? localesFor(draft.language) : [];
  const archived = draft?.status === "ARCHIVED";
  const warningsByCode = useMemo(() => {
    const groups = new Map<string, NonNullable<DraftDetail["validation"]>["warnings"]>();
    for (const warning of draft?.validation.warnings ?? []) groups.set(warning.code, [...(groups.get(warning.code) ?? []), warning]);
    return [...groups.entries()];
  }, [draft]);

  if (loadError) return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
    <p className="font-medium text-destructive">{loadError}</p>
    <Button className="mt-3" variant="outline" size="sm" onClick={() => void load()}>Try again</Button>
  </div>;
  if (!draft) return <div className="space-y-4" aria-busy="true" aria-label="Loading draft"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-6 w-1/3" /><Skeleton className="h-64 w-full" /></div>;

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try { await action(); } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
      if (error instanceof ContentRequestError && error.status === 409) void load();
    } finally { setBusy(null); }
  };

  const save = () => run("save", async () => {
    apply(await saveDraft(draft.id, organizationId, {expectedRevision: draft.revision, title: title.trim() || draft.title, content}));
    toast.success("Draft saved.");
    onChanged();
  });

  const changeStatus = (status: DraftStatus) => run(`status-${status}`, async () => {
    apply(await setDraftStatus(draft.id, organizationId, {expectedRevision: draft.revision, status}));
    toast.success(status === "ARCHIVED" ? "Draft archived." : status === "APPROVED" ? "Draft approved internally." : `Draft moved to ${STATUS_LABELS[status].toLowerCase()}.`);
    onChanged();
  });

  const restore = (versionNumber: number) => run(`restore-${versionNumber}`, async () => {
    apply(await restoreVersion(draft.id, organizationId, {expectedRevision: draft.revision, versionNumber}));
    setViewing(null);
    toast.success(`Version ${versionNumber} is now the current draft.`);
    onChanged();
  });

  const remove = () => run("delete", async () => {
    await deleteDraft(draft.id, organizationId);
    setConfirmDelete(false);
    toast.success("Draft deleted.");
    onDeleted();
  });

  const view = (versionNumber: number) => run(`view-${versionNumber}`, async () => {
    const {version} = await getVersion(draft.id, versionNumber);
    setViewing({versionNumber, title: version.title, kind: version.kind, content: version.contentData.content});
  });

  const copy = async () => {
    const text = locales.map(item => content[item] ? contentToPlainText(draft.contentType, content[item]!) : "").filter(Boolean).join("\n\n———\n\n");
    try {
      await navigator.clipboard.writeText(`${title}\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { toast.error("Copy failed. Select the text and copy it manually."); }
  };

  const requestGeneration = (request: GenerationRequest) => {
    if (dirty && !window.confirm("You have unsaved edits. Generating a new version will not include them. Continue?")) return;
    setRegenerateOpen(false);
    onGenerate(request, draft);
  };

  const purposeLabel = CONTENT_CATALOG[draft.contentType].purposes[draft.purpose]?.label ?? draft.purpose;
  const disabled = Boolean(busy) || generating;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <Label htmlFor="draft-title" className="sr-only">Draft title</Label>
        <Input id="draft-title" value={title} maxLength={200} disabled={archived || disabled} className="h-11 text-base font-semibold"
          onChange={event => { setTitle(event.target.value); setDirty(true); }} />
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={statusVariant(draft.status)}>{STATUS_LABELS[draft.status]}</Badge>
          <span>{CONTENT_CATALOG[draft.contentType].label} · {purposeLabel}</span>
          <span>· {LANGUAGE_LABELS[draft.language]} · {TONE_LABELS[draft.tone as ContentTone] ?? draft.tone} · {AUDIENCE_LABELS[draft.audience as ContentAudience] ?? draft.audience}</span>
          <span>· Version {draft.versionCount}</span>
          {!draft.isMine && draft.createdBy && <span>· By {draft.createdBy}</span>}
          {dirty && <span className="font-medium text-amber-700 dark:text-amber-400">· Unsaved changes</span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => void copy()} aria-live="polite">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}</Button>
        {!archived && <Button size="sm" onClick={() => void save()} disabled={!dirty || disabled}>{busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}Save</Button>}
      </div>
    </div>

    <div role="note" className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>Generated {formatTime(draft.validation.generatedAt)} from CRM data read at {formatTime(draft.validation.factsReadAt)}. Prices, availability and other details may have changed since. Recheck every detail before you use this draft. {draft.status === "APPROVED" ? "Internal approval does not mean approval by any advertising platform, portal or regulator." : "Nothing has been sent or published."}</p>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="inline-flex rounded-lg border p-0.5" role="group" aria-label="Draft view">
        <Button variant={mode === "preview" ? "secondary" : "ghost"} size="sm" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}><Eye className="size-4" />Preview</Button>
        <Button variant={mode === "edit" ? "secondary" : "ghost"} size="sm" aria-pressed={mode === "edit"} disabled={archived} onClick={() => setMode("edit")}><Pencil className="size-4" />Edit</Button>
      </div>
      {locales.length > 1 && <div className="inline-flex rounded-lg border p-0.5" role="tablist" aria-label="Language">
        {locales.map(item => <Button key={item} role="tab" aria-selected={locale === item} variant={locale === item ? "secondary" : "ghost"} size="sm" onClick={() => setLocale(item)}>{item === "en" ? "English" : "العربية"}</Button>)}
      </div>}
    </div>

    <div className="rounded-xl border bg-card p-4 sm:p-5">
      {content[locale]
        ? mode === "edit" && !archived
          ? <FieldsEditor type={draft.contentType} locale={locale} content={content[locale]!} adLimits={platform} disabled={disabled}
            onChange={next => { setContent(current => ({...current, [locale]: next})); setDirty(true); }} />
          : <ContentPreview type={draft.contentType} locale={locale} content={content[locale]!} adLimits={platform} from={companyName} />
        : <p className="text-sm text-muted-foreground">No {locale === "ar" ? "Arabic" : "English"} version in this draft.</p>}
    </div>

    <div className="flex flex-wrap gap-2">
      {!archived && <Button variant="outline" size="sm" disabled={disabled} onClick={() => setRegenerateOpen(true)}><RefreshCw className="size-4" />Regenerate or create alternative</Button>}
      {draft.status === "DRAFT" && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void changeStatus("IN_REVIEW")}><Send className="size-4" />Submit for review</Button>}
      {draft.canApprove && (draft.status === "DRAFT" || draft.status === "IN_REVIEW") && <Button variant="outline" size="sm" disabled={disabled || dirty} onClick={() => void changeStatus("APPROVED")}><CheckCircle2 className="size-4" />Approve internally</Button>}
      {(draft.status === "IN_REVIEW" || draft.status === "APPROVED") && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void changeStatus("DRAFT")}><Undo2 className="size-4" />Return to draft</Button>}
      {!archived && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void changeStatus("ARCHIVED")}><Archive className="size-4" />Archive</Button>}
      {archived && <Button variant="outline" size="sm" disabled={disabled} onClick={() => void changeStatus("DRAFT")}><ArchiveRestore className="size-4" />Restore from archive</Button>}
      <Button variant="ghost" size="sm" className="text-destructive" disabled={disabled} onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" />Delete</Button>
    </div>

    <section aria-labelledby="draft-checks" className="space-y-3 rounded-xl border p-4">
      <h3 id="draft-checks" className="text-sm font-semibold">Check before use</h3>
      {draft.validation.editedAfterGeneration && <p className="text-xs text-muted-foreground">Edited after generation. The checks below were re-run on the edited text against the CRM facts recorded at generation.</p>}
      {warningsByCode.length === 0 && !draft.validation.missingInformation.length && !draft.validation.claimsToReview.length
        ? <p className="text-sm text-muted-foreground">No automatic warnings. Automatic checks cannot prove the text is accurate; review it before use.</p>
        : <div className="space-y-3 text-sm">
          {draft.validation.missingInformation.length > 0 && <div><p className="font-medium">{WARNING_TITLES.MISSING_DATA}</p><ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted-foreground">{draft.validation.missingInformation.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
          {draft.validation.claimsToReview.length > 0 && <div><p className="font-medium">{WARNING_TITLES.MODEL_REVIEW}</p><ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted-foreground">{draft.validation.claimsToReview.map((item, index) => <li key={index}><span className="text-foreground">{item.claim}</span> — {item.reason}</li>)}</ul></div>}
          {warningsByCode.map(([code, items]) => <div key={code}>
            <p className="font-medium">{WARNING_TITLES[code] ?? code} ({items.length})</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">{items.slice(0, 15).map((item, index) => <li key={index}>
              {item.text && <span className="font-medium text-foreground" {...localeProps(item.locale ?? "en")}>“{item.text}”</span>} {item.message}{item.locale && locales.length > 1 ? ` (${item.locale === "ar" ? "Arabic" : "English"})` : ""}
            </li>)}</ul>
          </div>)}
        </div>}
      {draft.validation.sources.length > 0 && <div className="border-t pt-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Source records</p>
        <ul className="mt-1 space-y-0.5">{draft.validation.sources.map(source => <li key={`${source.kind}-${source.id}`}>
          {source.kind[0].toUpperCase() + source.kind.slice(1)}{source.reference ? ` ${source.reference}` : ""} · record last updated {formatTime(source.updatedAt)}
          {source.kind !== "lead" && source.kind !== "developer" && <> · <a className="text-primary underline-offset-2 hover:underline" href={`/${source.kind === "property" ? "properties" : source.kind === "listing" ? "listings" : "projects"}/${source.id}`}>Open</a></>}
          {source.kind === "lead" && <> · <a className="text-primary underline-offset-2 hover:underline" href={`/leads/${source.id}`}>Open</a></>}
        </li>)}</ul>
      </div>}
    </section>

    <section aria-labelledby="draft-versions" className="space-y-2 rounded-xl border p-4">
      <h3 id="draft-versions" className="flex items-center gap-2 text-sm font-semibold"><FileClock className="size-4" aria-hidden="true" />Version history</h3>
      <ul className="divide-y text-sm">{versions.map(version => <li key={version.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
        <span><span className="font-medium">Version {version.versionNumber}</span> · {KIND_LABELS[version.kind] ?? version.kind} · {formatTime(version.createdAt)}{version.createdBy ? ` · ${version.createdBy}` : ""}</span>
        <span className="flex gap-1">
          <Button variant="ghost" size="sm" disabled={disabled} onClick={() => void view(version.versionNumber)}>{busy === `view-${version.versionNumber}` ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}View</Button>
          {!archived && <Button variant="ghost" size="sm" disabled={disabled} onClick={() => void restore(version.versionNumber)}><Shuffle className="size-4" />Use this version</Button>}
        </span>
      </li>)}</ul>
    </section>

    <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate a new version</DialogTitle>
          <DialogDescription>EstateOS re-reads the source records with your current permissions. Regenerate replaces the current text; an alternative is added to the version history for you to compare. Earlier versions are kept.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="regenerate-length">Length</Label>
            <select id="regenerate-length" className={selectClass} value={regenerateLength} onChange={event => setRegenerateLength(event.target.value as ContentLength)}>
              {CONTENT_LENGTHS.map(item => <option key={item} value={item}>{LENGTH_LABELS[item]}</option>)}
            </select></div>
          <div className="space-y-1.5"><Label htmlFor="regenerate-instructions">Extra style instructions (optional)</Label>
            <textarea id="regenerate-instructions" className={cn(textareaClass, "min-h-24")} maxLength={1500} value={regenerateInstructions} onChange={event => setRegenerateInstructions(event.target.value)}
              placeholder="For example: shorter sentences, emphasise the view" />
            <p className="text-xs text-muted-foreground">Instructions change style only. They cannot add facts that are not in the CRM.</p></div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => requestGeneration({mode: "ALTERNATIVE", customInstructions: regenerateInstructions.trim() || undefined, length: regenerateLength})}><Shuffle className="size-4" />Create alternative</Button>
          <Button onClick={() => requestGeneration({mode: "REGENERATE", customInstructions: regenerateInstructions.trim() || undefined, length: regenerateLength})}><RefreshCw className="size-4" />Regenerate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <DialogContent>
        <DialogHeader><DialogTitle>Delete this draft?</DialogTitle><DialogDescription>The draft and all {draft.versionCount} versions are permanently deleted. Archive it instead if you may need it later.</DialogDescription></DialogHeader>
        <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button><Button variant="destructive" disabled={busy === "delete"} onClick={() => void remove()}>{busy === "delete" && <Loader2 className="size-4 animate-spin" />}Delete draft</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(viewing)} onOpenChange={open => { if (!open) setViewing(null); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        {viewing && <>
          <DialogHeader><DialogTitle>Version {viewing.versionNumber}: {viewing.title}</DialogTitle><DialogDescription>{KIND_LABELS[viewing.kind] ?? viewing.kind}. Read-only preview.</DialogDescription></DialogHeader>
          <div className="space-y-6">{locales.map(item => viewing.content[item] ? <div key={item} className="space-y-2">
            {locales.length > 1 && <p className="text-xs font-semibold text-muted-foreground">{item === "en" ? "English" : "Arabic"}</p>}
            <ContentPreview type={draft.contentType} locale={item} content={viewing.content[item]!} adLimits={platform} from={companyName} />
          </div> : null)}</div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewing(null)}>Close</Button>
            {!archived && <Button disabled={disabled} onClick={() => void restore(viewing.versionNumber)}><Shuffle className="size-4" />Use this version</Button>}
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
