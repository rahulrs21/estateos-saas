"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BookmarkPlus, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, websitesDelete, websitesGet, websitesSend } from "../../client";
import { SECTION_TEMPLATE_CATEGORIES } from "../../library";
import { SECTION_DEFINITIONS, type PageSection } from "../../registry";
import { inputClass } from "./controls";
import { useEditorServices } from "./editor-context";
import { SECTION_ICONS } from "./panels";

/*
 * The company library of saved sections: "My sections" in the Elements
 * panel and the "Save to library" dialog. Saved sections are validated on
 * the server and inserted with new IDs.
 */

export interface SavedSection { id: string; name: string; category: string; sectionType: string; section: PageSection; createdBy: string | null; canManage: boolean }

const listeners = new Set<() => void>();
/** Lets the save dialog refresh an open "My sections" list. */
const announceChange = () => listeners.forEach(listener => listener());

export function MySections({onInsert}: {onInsert: (section: PageSection) => void}) {
  const {organizationId} = useEditorServices();
  const [items, setItems] = useState<SavedSection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => websitesGet<SavedSection[]>("/api/websites/section-templates", "Saved sections could not be loaded.")
    .then(rows => { setItems(rows); setError(null); }, failure => setError(errorMessage(failure, "Saved sections could not be loaded."))), []);
  useEffect(() => {
    void load();
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, [load]);
  const remove = async (item: SavedSection) => {
    try {
      await websitesDelete(`/api/websites/section-templates/${item.id}`, organizationId, "The saved section could not be deleted.");
      setItems(current => (current ?? []).filter(row => row.id !== item.id));
      toast.success(`“${item.name}” removed from the library.`);
    } catch (failure) { toast.error(errorMessage(failure, "The saved section could not be deleted.")); }
  };
  return <div className="mb-5">
    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">My sections</p>
    {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    {!items && !error && <p className="flex items-center gap-1.5 text-xs text-zinc-500"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Loading…</p>}
    {items && !items.length && <p className="text-[11px] leading-4 text-zinc-500">Right-click a section on the page and choose “Save to library” to reuse it on other pages.</p>}
    {items && items.length > 0 && <ul className="space-y-1.5">{items.map(item => {
      const Icon = SECTION_ICONS[item.section.type];
      return <li key={item.id} className="group flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] hover:border-sky-400">
        <button type="button" onClick={() => onInsert(item.section)} title={`Insert “${item.name}”`} className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left">
          <Icon className="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
          <span className="min-w-0"><span className="block truncate text-xs font-medium text-zinc-100">{item.name}</span>
            <span className="block truncate text-[10px] text-zinc-500">{item.category} · {SECTION_DEFINITIONS[item.section.type].label}{item.createdBy ? ` · ${item.createdBy}` : ""}</span></span>
        </button>
        {item.canManage && <button type="button" onClick={() => void remove(item)} aria-label={`Delete saved section ${item.name}`} className="mr-1 rounded p-1 text-zinc-500 opacity-0 hover:bg-red-500/20 hover:text-red-300 group-hover:opacity-100 focus:opacity-100"><Trash2 className="size-3.5" /></button>}
      </li>;
    })}</ul>}
  </div>;
}

export function SaveSectionDialog({section, onClose}: {section: PageSection; onClose: () => void}) {
  const {organizationId} = useEditorServices();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      await websitesSend("/api/websites/section-templates", organizationId, "POST", {name: String(form.get("name") ?? "").trim(), category: String(form.get("category") ?? "General"), section},
        "The section could not be saved to the library.");
      announceChange();
      toast.success("Saved to the library. Find it under My sections in Elements.");
      onClose();
    } catch (failure) { setError(errorMessage(failure, "The section could not be saved to the library.")); } finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-labelledby="save-section-title" className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={onClose}>
    <form onSubmit={submit} onClick={event => event.stopPropagation()} className="w-full max-w-sm space-y-4 rounded-lg border border-white/10 bg-zinc-900 p-5 text-zinc-100 shadow-2xl">
      <div className="flex items-center justify-between"><h2 id="save-section-title" className="flex items-center gap-2 text-base font-semibold"><BookmarkPlus className="size-4 text-sky-300" aria-hidden="true" />Save to library</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-zinc-400 hover:bg-white/10"><X className="size-4" /></button></div>
      <p className="text-xs leading-5 text-zinc-400">Everyone in your company who edits pages can insert it. Project photos are removed, because they belong to one record; uploads, stock media and text are kept.</p>
      <label className="block space-y-1 text-sm">Name<input name="name" required maxLength={120} autoFocus defaultValue={SECTION_DEFINITIONS[section.type].label} className={inputClass} /></label>
      <label className="block space-y-1 text-sm">Category<select name="category" defaultValue="General" className={`${inputClass} [&>option]:bg-zinc-900`}>{SECTION_TEMPLATE_CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-sky-400">Cancel</button>
        <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-md bg-sky-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-400 disabled:opacity-50">{busy && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}Save</button>
      </div>
    </form>
  </div>;
}
