"use client";

import { useEffect, useId, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listSourceOptions, type SourceOption } from "../client";

export type PickerKind = "property" | "listing" | "project" | "lead";

const KIND_LABELS: Record<PickerKind, string> = {property: "Property", listing: "Listing", project: "Project", lead: "Lead"};
const KIND_PLURALS: Record<PickerKind, string> = {property: "properties", listing: "listings", project: "projects", lead: "leads"};

/**
 * Searches records the signed-in member may use, through the same services
 * and role rules as the CRM lists. The chosen IDs are references only: the
 * server re-reads and re-authorizes every one when generating.
 */
export function SourcePicker({kind, selected, onChange, max = 1, disabled, label, hint}: {
  kind: PickerKind; selected: SourceOption[]; onChange: (options: SourceOption[]) => void; max?: number; disabled?: boolean; label?: string; hint?: string;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SourceOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const full = selected.length >= max;

  useEffect(() => {
    if (!open || full) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listSourceOptions(kind, {search}).then(result => {
        if (cancelled) return;
        setOptions(result.options);
        setError(null);
      }).catch(failure => {
        if (!cancelled) { setOptions([]); setError(failure instanceof Error ? failure.message : "Records could not be loaded."); }
      }).finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [kind, search, open, full]);

  const choose = (option: SourceOption) => {
    if (selected.some(item => item.id === option.id)) return;
    onChange(max === 1 ? [option] : [...selected, option].slice(0, max));
    setSearch("");
    setOpen(max > 1 && selected.length + 1 < max);
  };

  return <div className="space-y-1.5">
    <Label htmlFor={id}>{label ?? KIND_LABELS[kind]}{max > 1 ? ` (up to ${max})` : ""}</Label>
    {selected.length > 0 && <ul className="space-y-1.5" aria-label={`Selected ${KIND_PLURALS[kind]}`}>
      {selected.map(option => <li key={option.id} className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span className="min-w-0 flex-1"><span className="block truncate font-medium">{option.label}</span>{option.detail && <span className="block truncate text-xs text-muted-foreground">{option.detail}</span>}</span>
        <Button type="button" variant="ghost" size="icon" className="size-7" disabled={disabled} aria-label={`Remove ${option.label}`} onClick={() => onChange(selected.filter(item => item.id !== option.id))}><X className="size-4" /></Button>
      </li>)}
    </ul>}
    {!full && <div className="relative">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input id={id} value={search} disabled={disabled} className="ps-9" placeholder={`Search ${KIND_PLURALS[kind]}`} autoComplete="off"
        role="combobox" aria-expanded={open} aria-controls={`${id}-options`}
        onFocus={() => setOpen(true)} onChange={event => { setSearch(event.target.value); setOpen(true); }}
        onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} />
      {open && <div id={`${id}-options`} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
        {loading && <p className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Searching…</p>}
        {!loading && error && <p className="px-3 py-2 text-sm text-destructive">{error}</p>}
        {!loading && !error && options?.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No matching records you can use.</p>}
        {!loading && options?.map(option => <button key={option.id} type="button" role="option" aria-selected={selected.some(item => item.id === option.id)}
          className="block w-full rounded-md px-3 py-2 text-start text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none" onClick={() => choose(option)}>
          <span className="block truncate font-medium">{option.label}</span>{option.detail && <span className="block truncate text-xs text-muted-foreground">{option.detail}</span>}
        </button>)}
        <button type="button" className="mt-1 block w-full rounded-md px-3 py-1.5 text-start text-xs text-muted-foreground hover:bg-muted" onClick={() => setOpen(false)}>Close</button>
      </div>}
    </div>}
    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
  </div>;
}
