"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ArrowLeft, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { communicationsGet, errorMessage } from "@/modules/communications/client";
import type { TemplatesView } from "../server/whatsapp-templates";
import { CATEGORY_LABELS, renderTemplate, templateValueProblems, type TemplateValues, type WhatsAppTemplate } from "../whatsapp-templates";

/*
 * Choosing an approved WhatsApp template (Phase 7B.2): the list comes from Meta
 * through the server, the member fills in its blanks, and the preview shows exactly
 * what the customer will receive. The server checks the template and the values
 * again before drafting and before sending.
 */

export type ChosenTemplate = {name: string; language: string; values: TemplateValues};
export type QuickFill = {label: string; value: string};

const blankLabel = (template: WhatsAppTemplate, id: string) => {
  const variable = template.variables.find(item => item.id === id);
  if (!variable) return id;
  const where = variable.part === "HEADER" ? "header" : "message";
  return template.format === "NAMED" ? `${variable.key.replace(/_/g, " ")} (${where})` : `Blank ${variable.key} in the ${where}`;
};

/** The message as WhatsApp shows it: a light bubble with the header, body, footer and buttons. */
export function TemplatePreview({template, values}: {template: WhatsAppTemplate; values: TemplateValues}) {
  const rendered = renderTemplate(template, values);
  return <div className="rounded-xl bg-[#e7f7e1] p-3 text-[13px] leading-5 text-[#111b21] shadow-xs dark:bg-[#1f3b2c] dark:text-[#e9edef]" data-testid="template-preview">
    {rendered.header && <p className="mb-1 font-semibold" dir="auto">{rendered.header}</p>}
    <p className="whitespace-pre-wrap wrap-break-word" dir="auto">{rendered.body}</p>
    {rendered.footer && <p className="mt-1.5 text-[11px] opacity-70" dir="auto">{rendered.footer}</p>}
    {template.buttons.some(button => button.text) && <div className="mt-2 flex flex-wrap gap-1.5 border-t border-black/10 pt-2 dark:border-white/10">
      {template.buttons.filter(button => button.text).map((button, index) => <span key={index} className="rounded-md bg-white/70 px-2 py-0.5 text-[12px] font-medium text-sky-700 dark:bg-white/10 dark:text-sky-300">{button.text}</span>)}
    </div>}
  </div>;
}

export function TemplatePicker({source, quickFills, submitLabel, busy, onSubmit, onCancel}: {
  /** The server route listing this channel's templates. */
  source: string; quickFills: QuickFill[]; submitLabel: string; busy: boolean;
  /** The chosen template, and the exact text the customer will receive. */
  onSubmit: (template: ChosenTemplate, text: string) => Promise<boolean> | Promise<void> | void; onCancel?: () => void;
}) {
  const prefix = useId();
  const [view, setView] = useState<TemplatesView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<WhatsAppTemplate | null>(null);
  const [values, setValues] = useState<TemplateValues>({});
  const [touched, setTouched] = useState(false);
  const fetchTemplates = useCallback(() => communicationsGet<TemplatesView>(source, "The templates could not be loaded.")
    .then(data => { setView(data); setError(null); }, problem => setError(errorMessage(problem, "The templates could not be loaded."))), [source]);
  useEffect(() => { void fetchTemplates(); }, [fetchTemplates]);
  const load = () => { setError(null); setView(null); void fetchTemplates(); };

  const listed = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (view?.templates ?? []).filter(item => !term || `${item.name} ${item.body} ${item.header ?? ""}`.toLowerCase().includes(term));
  }, [view, search]);
  const problems = chosen ? templateValueProblems(chosen, values) : {};
  const ready = chosen !== null && Object.keys(problems).length === 0;
  const choose = (template: WhatsAppTemplate) => {
    setChosen(template);
    setTouched(false);
    // Start from Meta's own examples only as placeholders, never as values: every blank is filled in deliberately.
    setValues({});
  };

  if (error) return <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm" data-testid="template-picker">
    <p className="text-destructive">{error}</p>
    <Button type="button" size="sm" variant="outline" onClick={load}><RefreshCw aria-hidden />Try again</Button>
  </div>;
  if (!view) return <div role="status" aria-label="Loading templates" className="space-y-2 rounded-xl border p-3" data-testid="template-picker">
    <Skeleton className="h-8 w-full" /><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>;

  if (!chosen) return <div className="space-y-2 rounded-xl border bg-background p-3" data-testid="template-picker">
    <div className="flex items-center gap-2">
      <div className="relative flex-1"><Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <label htmlFor={`${prefix}-search`} className="sr-only">Search templates</label>
        <Input id={`${prefix}-search`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search approved templates" className="h-8 pl-8" maxLength={80} /></div>
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Reload templates" onClick={load}><RefreshCw aria-hidden /></Button>
      {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
    </div>
    {!view.templates.length ? <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">No approved templates yet</p>
      <p className="mt-1 text-xs">Create one in WhatsApp Manager → Message templates. Once Meta approves it, it appears here.{view.others.length ? ` ${view.others.length} other template${view.others.length === 1 ? " is" : "s are"} pending, paused, rejected or not supported yet.` : ""}</p>
    </div>
      : <ul className="max-h-64 space-y-1.5 overflow-y-auto" aria-label="Approved templates">{listed.map(template => <li key={`${template.name}:${template.language}`}>
        <button type="button" onClick={() => choose(template)} data-testid="template-option"
          className="w-full rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex flex-wrap items-center gap-1.5"><FileText aria-hidden className="size-3.5 text-primary" /><span className="text-sm font-medium">{template.name}</span>
            <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{template.language}</Badge>
            {template.category && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{CATEGORY_LABELS[template.category] ?? template.category.toLowerCase()}</Badge>}
            {template.variables.length > 0 && <span className="text-[11px] text-muted-foreground">{template.variables.length} blank{template.variables.length === 1 ? "" : "s"}</span>}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground" dir="auto">{template.header ? `${template.header} · ` : ""}{template.body}</span>
        </button></li>)}
        {!listed.length && <li className="py-3 text-center text-xs text-muted-foreground">No template matches “{search}”.</li>}
      </ul>}
    {view.others.length > 0 && view.templates.length > 0 && <p className="text-[11px] text-muted-foreground">{view.others.length} other template{view.others.length === 1 ? " is" : "s are"} not approved or not supported yet, so {view.others.length === 1 ? "it is" : "they are"} not listed.</p>}
  </div>;

  return <form className="space-y-3 rounded-xl border bg-background p-3" data-testid="template-picker"
    onSubmit={async event => { event.preventDefault(); setTouched(true); if (ready) await onSubmit({name: chosen.name, language: chosen.language, values}, renderTemplate(chosen, values).text); }}>
    <div className="flex items-center gap-2">
      <Button type="button" size="icon-sm" variant="ghost" aria-label="Choose another template" onClick={() => setChosen(null)}><ArrowLeft aria-hidden /></Button>
      <p className="min-w-0 flex-1 truncate text-sm font-medium">{chosen.name} <span className="text-xs font-normal text-muted-foreground">· {chosen.language}{chosen.category ? ` · ${CATEGORY_LABELS[chosen.category] ?? chosen.category.toLowerCase()}` : ""}</span></p>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2.5">
        {chosen.variables.length === 0 ? <p className="text-xs text-muted-foreground">This template has no blanks to fill in.</p>
          : chosen.variables.map(variable => {
            const id = `${prefix}-${variable.id.replace(/[^A-Za-z0-9]/g, "-")}`;
            const problem = touched || values[variable.id] ? problems[variable.id] : undefined;
            return <div key={variable.id} className="space-y-1">
              <label htmlFor={id} className="text-xs font-medium">{blankLabel(chosen, variable.id)}</label>
              <Input id={id} name={`template-${variable.id}`} value={values[variable.id] ?? ""} maxLength={1000} placeholder={variable.example ? `For example: ${variable.example}` : "Fill this in"} aria-invalid={problem ? true : undefined}
                onChange={event => setValues(current => ({...current, [variable.id]: event.target.value}))} className="h-8" dir="auto" />
              {quickFills.length > 0 && <div className="flex flex-wrap gap-1">{quickFills.filter(fill => fill.value).map(fill => <button key={fill.label} type="button"
                onClick={() => setValues(current => ({...current, [variable.id]: fill.value}))}
                className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground">{fill.label}</button>)}</div>}
              {problem && <p className="text-[11px] text-destructive">{problem}</p>}
            </div>;
          })}
        {(touched && (problems.HEADER || problems.BODY)) && <p className="text-[11px] text-destructive">{problems.HEADER ?? problems.BODY}</p>}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">What the customer receives</p>
        <TemplatePreview template={chosen} values={values} />
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onCancel && <Button type="button" size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>}
      <Button type="submit" size="sm" disabled={busy || (touched && !ready)} className={cn(!ready && "opacity-80")}>{busy && <Loader2 aria-hidden className="animate-spin" />}{submitLabel}</Button>
    </div>
  </form>;
}
