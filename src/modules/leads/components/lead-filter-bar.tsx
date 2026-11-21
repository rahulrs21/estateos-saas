"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownUp, CalendarDays, Check, ChevronDown, Flag, GitBranch, Megaphone, Search, SlidersHorizontal, UserRound, CircleDot, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { leadPriorityLabels, leadSortLabels } from "../presentation";
import type { LeadFilters, LeadListData } from "../types";
import { leadStatusLabels, leadStatusOptions } from "./lead-ui";

const STATUS_DOTS: Record<(typeof leadStatusOptions)[number], string> = { NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500", VIEWING_SCHEDULED: "bg-violet-400", VIEWING_COMPLETED: "bg-violet-600", NEGOTIATION: "bg-orange-500", WON: "bg-emerald-500", LOST: "bg-slate-400", CONVERTED: "bg-emerald-600" };
const PRIORITY_DOTS = { LOW: "bg-slate-400", NORMAL: "bg-primary/60", HIGH: "bg-amber-500", URGENT: "bg-destructive" } as const;
type Option = { value: string; label: string; hint?: string; dot?: string };

/** A filter "chip": a dropdown of choices that applies on selection. */
function FilterMenu({ label, icon, value, options, allLabel, onChange, testId, disabled }: {
  label: string; icon: ReactNode; value: string; options: Option[]; allLabel: string;
  onChange: (value: string) => void; testId: string; disabled?: boolean;
}) {
  const selected = options.find(option => option.value === value);
  return <DropdownMenu>
    <DropdownMenuTrigger disabled={disabled} data-testid={testId} render={<Button variant="outline" size="sm" aria-label={`${label}: ${selected?.label ?? allLabel}`}
      className={cn("h-8 gap-1.5 rounded-full px-3 font-normal", selected ? "border-primary/40 bg-primary/5 text-foreground hover:bg-primary/10" : "border-dashed text-muted-foreground")} />}>
      <span className="[&_svg]:size-3.5" aria-hidden="true">{icon}</span>
      <span className={selected ? "text-muted-foreground" : ""}>{label}</span>
      {selected && <><span className="h-3.5 w-px bg-border" aria-hidden="true" /><span className="max-w-36 truncate font-medium">{selected.label}</span></>}
      <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-60">
      <DropdownMenuGroup>
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={value} onValueChange={next => onChange(String(next))}>
          <DropdownMenuRadioItem value="">{allLabel}</DropdownMenuRadioItem>
          {options.map(option => <DropdownMenuRadioItem key={option.value} value={option.value}>
            {option.dot && <span className={cn("size-2 shrink-0 rounded-full", option.dot)} aria-hidden="true" />}<span className="min-w-0 flex-1 truncate">{option.label}</span>{option.hint && <span className="text-[11px] text-muted-foreground">{option.hint}</span>}
          </DropdownMenuRadioItem>)}
        </DropdownMenuRadioGroup>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);
/** Date presets, as UTC calendar days (the server filters on UTC days). */
function datePreset(kind: "TODAY" | "7" | "30" | "MONTH") {
  const today = new Date();
  const from = new Date(today);
  if (kind === "7") from.setUTCDate(from.getUTCDate() - 6);
  if (kind === "30") from.setUTCDate(from.getUTCDate() - 29);
  if (kind === "MONTH") from.setUTCDate(1);
  return { createdFrom: isoDay(from), createdTo: isoDay(today) };
}
const shortDay = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${value}T00:00:00Z`));
function dateLabel(from: string, to: string) {
  if (from && to) return from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;
  if (from) return `From ${shortDay(from)}`;
  return to ? `Until ${shortDay(to)}` : "";
}

/**
 * Search, dropdown filters and sorting for the leads list. Every change navigates to a
 * new URL (page 1); the server reads the filters from it and applies permissions.
 */
export function LeadFilterBar({ data, pending, onChange }: { data: LeadListData; pending: boolean; onChange: (changes: Partial<LeadFilters>) => void }) {
  const { filters, assignees, sources, branches, membership } = data;
  const [search, setSearch] = useState(filters.search);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState({ from: filters.createdFrom, to: filters.createdTo });
  const [rangeError, setRangeError] = useState("");
  // Every filter change carries the typed search too, and goes back to page 1.
  const apply = (changes: Partial<LeadFilters>) => onChange({ search: search.trim(), ...changes, page: 1 });
  const active = [filters.search, filters.status, filters.assignedMembershipId, filters.sourceId, filters.priority, filters.createdFrom || filters.createdTo, filters.branchId, filters.followUp !== "ALL" ? filters.followUp : ""].filter(Boolean).length;

  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply({}); }
  function submitRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (range.from && range.to && range.from > range.to) { setRangeError("The end date must be on or after the start date."); return; }
    setRangeError(""); setRangeOpen(false);
    apply({ createdFrom: range.from, createdTo: range.to });
  }

  const dates = dateLabel(filters.createdFrom, filters.createdTo);
  return <div className="space-y-3 border-b p-4 sm:px-5" aria-label="Search and filter leads" role="search">
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <form onSubmit={submitSearch} className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input name="search" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Search name, email or phone" aria-label="Search leads" className="h-9 pl-9" />
      </form>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger disabled={pending} data-testid="lead-sort" render={<Button variant="outline" size="sm" className="h-9 gap-1.5" aria-label={`Sort: ${leadSortLabels[filters.sort]}`} />}>
            <ArrowDownUp aria-hidden="true" /><span className="text-muted-foreground">Sort</span><span className="font-medium">{leadSortLabels[filters.sort]}</span><ChevronDown className="opacity-60" aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup value={filters.sort} onValueChange={value => apply({ sort: value as LeadFilters["sort"] })}>
              {Object.entries(leadSortLabels).map(([value, label]) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" /><span className="sr-only">Filters</span>
      <FilterMenu testId="lead-filter-status" label="Status" icon={<CircleDot />} allLabel="All statuses" value={filters.status} disabled={pending}
        options={leadStatusOptions.map(status => ({ value: status, label: leadStatusLabels[status], dot: STATUS_DOTS[status] }))} onChange={status => apply({ status: status as LeadFilters["status"] })} />
      <FilterMenu testId="lead-filter-agent" label="Agent" icon={<UserRound />} allLabel="All permitted agents" value={filters.assignedMembershipId} disabled={pending}
        options={assignees.map(member => ({ value: member.id, label: member.userProfile?.displayName || member.email, hint: member.id === membership.id ? "You" : undefined }))} onChange={assignedMembershipId => apply({ assignedMembershipId })} />
      <FilterMenu testId="lead-filter-source" label="Source" icon={<Megaphone />} allLabel="All sources" value={filters.sourceId} disabled={pending}
        options={sources.map(source => ({ value: source.id, label: source.name }))} onChange={sourceId => apply({ sourceId })} />
      <FilterMenu testId="lead-filter-priority" label="Priority" icon={<Flag />} allLabel="All priorities" value={filters.priority} disabled={pending}
        options={Object.entries(leadPriorityLabels).map(([value, label]) => ({ value, label, dot: PRIORITY_DOTS[value as keyof typeof PRIORITY_DOTS] }))} onChange={priority => apply({ priority: priority as LeadFilters["priority"] })} />

      <DropdownMenu>
        <DropdownMenuTrigger disabled={pending} data-testid="lead-filter-created" render={<Button variant="outline" size="sm" aria-label={`Created: ${dates || "Any time"}`}
          className={cn("h-8 gap-1.5 rounded-full px-3 font-normal", dates ? "border-primary/40 bg-primary/5 hover:bg-primary/10" : "border-dashed text-muted-foreground")} />}>
          <CalendarDays className="size-3.5" aria-hidden="true" /><span className={dates ? "text-muted-foreground" : ""}>Created</span>
          {dates && <><span className="h-3.5 w-px bg-border" aria-hidden="true" /><span className="font-medium">{dates}</span></>}<ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Created (UTC days)</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => apply({ createdFrom: "", createdTo: "" })}>Any time{!dates && <Check className="ml-auto" aria-hidden="true" />}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => apply(datePreset("TODAY"))}>Today</DropdownMenuItem>
            <DropdownMenuItem onClick={() => apply(datePreset("7"))}>Last 7 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => apply(datePreset("30"))}>Last 30 days</DropdownMenuItem>
            <DropdownMenuItem onClick={() => apply(datePreset("MONTH"))}>This month</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { setRange({ from: filters.createdFrom, to: filters.createdTo }); setRangeError(""); setRangeOpen(true); }}>Custom range…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {branches.length > 0 && <FilterMenu testId="lead-filter-branch" label="Branch" icon={<GitBranch />} allLabel="All branches" value={filters.branchId} disabled={pending}
        options={branches.map(branch => ({ value: branch.id, label: branch.name }))} onChange={branchId => apply({ branchId })} />}
      <FilterMenu testId="lead-filter-follow-up" label="Follow-up" icon={<CalendarDays />} allLabel="All follow-ups" value={filters.followUp === "ALL" ? "" : filters.followUp} disabled={pending}
        options={[{ value: "OVERDUE", label: "Overdue" }, { value: "UPCOMING", label: "Upcoming" }]} onChange={followUp => apply({ followUp: (followUp || "ALL") as LeadFilters["followUp"] })} />

      {active > 0 && <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" disabled={pending} onClick={() => { setSearch(""); onChange({ search: "", status: "", assignedMembershipId: "", sourceId: "", priority: "", createdFrom: "", createdTo: "", branchId: "", followUp: "ALL", page: 1 }); }}>
        <X aria-hidden="true" />Clear filters<span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{active}</span>
      </Button>}
    </div>

    <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submitRange} className="grid gap-4">
          <DialogHeader><DialogTitle>Created between</DialogTitle><DialogDescription>UTC calendar days, both included.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="lead-created-from" className="text-xs">From</Label><Input id="lead-created-from" type="date" name="createdFrom" value={range.from} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} /></div>
            <div className="space-y-2"><Label htmlFor="lead-created-to" className="text-xs">Through</Label><Input id="lead-created-to" type="date" name="createdTo" value={range.to} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} /></div>
          </div>
          {rangeError && <p role="alert" className="text-xs text-destructive">{rangeError}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setRangeOpen(false)}>Cancel</Button><Button type="submit">Apply range</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
}
