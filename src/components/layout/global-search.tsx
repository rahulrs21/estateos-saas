"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, ContactRound, CornerDownLeft, LoaderCircle, Megaphone, Search, UsersRound, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { SEARCH_MIN_LENGTH, SEARCH_MAX_LENGTH, type SearchGroupKey, type SearchItem, type SearchResult } from "@/modules/search/search-model";

const ICONS: Record<SearchGroupKey, LucideIcon> = {leads: UsersRound, contacts: ContactRound, properties: Building2, listings: Megaphone};
const DEBOUNCE_MS = 250;

type Outcome = {query: string; result: SearchResult | null; error: string | null};

/**
 * Header search across the leads, contacts, properties and listings the
 * member may see (GET /api/search, which reuses the existing scoped list
 * operations). Opens with the header field or Ctrl/⌘ K; arrow keys move
 * through results and Enter opens one.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmed = query.trim();
  const searchable = trimmed.length >= SEARCH_MIN_LENGTH;

  // Ctrl/⌘ K anywhere opens search.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced lookup; a newer query cancels the one in flight.
  useEffect(() => {
    if (!open || !searchable) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search?${new URLSearchParams({q: trimmed})}`, {credentials: "same-origin", cache: "no-store", signal: controller.signal})
        .then(async response => {
          const body = await response.json().catch(() => null) as {data?: SearchResult; error?: {message?: string}} | null;
          if (!response.ok || !body?.data) throw new Error(body?.error?.message || "Search is unavailable right now.");
          setOutcome({query: trimmed, result: body.data, error: null});
          setActive(0);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          setOutcome({query: trimmed, result: null, error: error instanceof Error ? error.message : "Search is unavailable right now."});
        });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, searchable, trimmed]);

  const current = outcome?.query === trimmed ? outcome : null;
  const loading = searchable && !current;
  const flat = useMemo(() => current?.result?.groups.flatMap(group => group.items.map(item => ({...item, group: group.key}))) ?? [], [current]);

  function close(next: boolean) {
    setOpen(next);
    if (!next) { setQuery(""); setOutcome(null); setActive(0); }
  }
  function go(item: SearchItem) {
    close(false);
    router.push(item.href);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!flat.length) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => (index + 1) % flat.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => (index - 1 + flat.length) % flat.length); }
    else if (event.key === "Enter") { event.preventDefault(); const item = flat[active]; if (item) go(item); }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Search leads, contacts, properties and listings"
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-9 md:w-64 md:justify-start md:gap-2 md:border md:bg-background md:px-3 lg:w-80">
      <Search className="size-4 shrink-0" aria-hidden="true" />
      <span className="hidden truncate text-sm md:inline">Search leads, properties…</span>
      <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted-foreground md:inline">Ctrl K</kbd>
    </button>
    <Dialog open={open} onOpenChange={close}>
      <DialogContent showCloseButton={false} initialFocus={inputRef} className="top-[12%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          {loading ? <LoaderCircle className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" /> : <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} onKeyDown={onKeyDown} maxLength={SEARCH_MAX_LENGTH}
            placeholder="Search leads, contacts, properties and listings" aria-label="Search" role="combobox" aria-expanded={flat.length > 0} aria-controls="global-search-results"
            aria-activedescendant={flat[active] ? `search-${flat[active].group}-${flat[active].id}` : undefined}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div id="global-search-results" role="listbox" aria-label="Search results" className="max-h-[60vh] overflow-y-auto p-2">
          {!searchable && <p className="px-3 py-8 text-center text-sm text-muted-foreground">Type at least {SEARCH_MIN_LENGTH} characters to search.</p>}
          {searchable && current?.error && <p role="alert" className="px-3 py-8 text-center text-sm text-destructive">{current.error}</p>}
          {searchable && current?.result && !flat.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results for “{trimmed}”.</p>}
          {current?.result?.groups.map(group => {
            const Icon = ICONS[group.key];
            return <div key={group.key} role="group" aria-label={group.label} className="mb-1">
              <p className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group.label}</p>
              {group.items.map(item => {
                const index = flat.findIndex(entry => entry.group === group.key && entry.id === item.id);
                const selected = index === active;
                return <div key={item.id} id={`search-${group.key}-${item.id}`} role="option" aria-selected={selected}
                  onMouseMove={() => setActive(index)} onClick={() => go(item)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2", selected && "bg-muted")}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary" aria-hidden="true"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                  </span>
                  {selected && <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden="true" />}
                </div>;
              })}
            </div>;
          })}
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
