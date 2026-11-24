"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownUp, CalendarDays, ChevronDown, CircleDot, Clock, Flag, GitBranch, Megaphone, Radio, Search, Target, UserRound, X } from "lucide-react";
import { LEAD_CHANNELS, LEAD_CHANNEL_LABELS } from "@/modules/lead-capture/attribution";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { leadDateRangeLabels, leadPriorityLabels, leadSortLabels } from "../presentation";
import type { LeadFilters, LeadListData } from "../types";
import { leadStatusLabels, leadStatusOptions } from "./lead-ui";

export const STATUS_DOTS: Record<(typeof leadStatusOptions)[number], string> = { NEW: "bg-blue-500", CONTACTED: "bg-amber-500", QUALIFIED: "bg-violet-500", VIEWING_SCHEDULED: "bg-indigo-500", VIEWING_COMPLETED: "bg-cyan-600", NEGOTIATION: "bg-orange-500", WON: "bg-emerald-500", LOST: "bg-slate-400", CONVERTED: "bg-emerald-600" };
const PRIORITY_DOTS = { LOW: "bg-slate-400", NORMAL: "bg-slate-500", HIGH: "bg-amber-500", URGENT: "bg-red-500" } as const;
type Option = { value: string; label: string; hint?: string; dot?: string };

/** A compact filter button: a dropdown of choices that applies on selection. */
function FilterMenu({ label, icon, value, options, allLabel, onChange, testId, disabled }: {
  label: string; icon: ReactNode; value: string; options: Option[]; allLabel: string;
  onChange: (value: string) => void; testId: string; disabled?: boolean;
}) {
  const selected = options.find(option => option.value === value);
  return <DropdownMenu>
    <DropdownMenuTrigger disabled={disabled} data-testid={testId} render={<Button variant="outline" size="sm" aria-label={`${label}: ${selected?.label ?? allLabel}`}
      className={cn("h-7 gap-1.5 rounded-md px-2 text-xs font-normal shadow-none", selected ? "border-foreground/20 bg-accent text-foreground" : "text-muted-foreground")} />}>
      <span className="[&_svg]:size-3.5" aria-hidden="true">{icon}</span>
      {label}
      {selected && <><span className="text-muted-foreground">is</span><span className="max-w-32 truncate font-medium">{selected.label}</span></>}
      <ChevronDown className="size-3 opacity-50" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
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

const shortDay = (value: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
/** "3 Nov 2026 – 2 Dec 2026", or one day, for the range button's tooltip and custom label. */
export function leadDateSpan(from: string, to: string) {
  if (from && to) return from === to ? shortDay(from) : `${shortDay(from)} – ${shortDay(to)}`;
  if (from) return `From ${shortDay(from)}`;
  return to ? `Until ${shortDay(to)}` : "All time";
}

const PRESETS = ["TODAY", "YESTERDAY", "7D", "30D", "LAST_MONTH", "ALL"] as const;

/**
 * The created-date window for the list and the board: presets (Last 30 days by
 * default) or a custom range. The server turns the choice into Dubai calendar days.
 */
export function LeadDateRangeMenu({ filters, pending, onChange }: { filters: LeadFilters; pending: boolean; onChange: (changes: Partial<LeadFilters>) => void }) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({ from: filters.createdFrom, to: filters.createdTo });
  const [error, setError] = useState("");
  const label = filters.range === "CUSTOM" ? leadDateSpan(filters.createdFrom, filters.createdTo) : leadDateRangeLabels[filters.range];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!range.from && !range.to) { setError("Choose a start date, an end date, or both."); return; }
    if (range.from && range.to && range.from > range.to) { setError("The end date must be on or after the start date."); return; }
    setError(""); setOpen(false);
    onChange({ range: "CUSTOM", createdFrom: range.from, createdTo: range.to, page: 1 });
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} data-testid="lead-date-range" render={<Button variant="outline" size="sm" className="h-8 gap-1.5 px-2.5 text-xs" aria-label={`Created: ${label}`} title={filters.range === "ALL" ? "All time" : leadDateSpan(filters.createdFrom, filters.createdTo)} />}>
        <CalendarDays className="size-3.5 text-muted-foreground" aria-hidden="true" /><span className="font-medium">{label}</span><ChevronDown className="size-3 opacity-50" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Created</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={filters.range} onValueChange={value => onChange({ range: value as LeadFilters["range"], createdFrom: "", createdTo: "", page: 1 })}>
            {PRESETS.map(preset => <DropdownMenuRadioItem key={preset} value={preset}>{leadDateRangeLabels[preset]}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setRange({ from: filters.createdFrom, to: filters.createdTo }); setError(""); setOpen(true); }}>
          <CalendarDays aria-hidden="true" />Custom range…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader><DialogTitle>Custom date range</DialogTitle><DialogDescription>Leads created between these days (Dubai time), both included.</DialogDescription></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="lead-created-from" className="text-xs">From</Label><Input id="lead-created-from" type="date" name="createdFrom" value={range.from} max={range.to || undefined} onChange={event => setRange(current => ({ ...current, from: event.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="lead-created-to" className="text-xs">To</Label><Input id="lead-created-to" type="date" name="createdTo" value={range.to} min={range.from || undefined} onChange={event => setRange(current => ({ ...current, to: event.target.value }))} /></div>
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Apply</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}

/**
 * Search, filters and sorting for the leads list and board. Every change navigates
 * to a new URL (page 1); the server reads the filters from it and applies permissions.
 */
export function LeadFilterBar({ data, pending, onChange }: { data: LeadListData; pending: boolean; onChange: (changes: Partial<LeadFilters>) => void }) {
  const { filters, assignees, sources, branches, membership, campaigns } = data;
  const [search, setSearch] = useState(filters.search);
  // Every filter change carries the typed search too, and goes back to page 1.
  const apply = (changes: Partial<LeadFilters>) => onChange({ search: search.trim(), ...changes, page: 1 });
  const active = [filters.search, filters.status, filters.assignedMembershipId, filters.sourceId, filters.priority, filters.branchId, filters.channel, filters.campaign, filters.followUp !== "ALL" ? filters.followUp : ""].filter(Boolean).length;

  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); apply({}); }

  return <div className="flex flex-col gap-2 border-b px-3 py-2.5 lg:flex-row lg:items-center" aria-label="Search and filter leads" role="search">
    <form onSubmit={submitSearch} className="relative lg:w-64">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input name="search" type="search" value={search} onChange={event => setSearch(event.target.value)} maxLength={120} placeholder="Search leads" aria-label="Search leads by name, email or phone" className="h-8 pl-8 text-sm" />
    </form>
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      <FilterMenu testId="lead-filter-status" label="Status" icon={<CircleDot />} allLabel="Any status" value={filters.status} disabled={pending}
        options={leadStatusOptions.map(status => ({ value: status, label: leadStatusLabels[status], dot: STATUS_DOTS[status] }))} onChange={status => apply({ status: status as LeadFilters["status"] })} />
      <FilterMenu testId="lead-filter-agent" label="Agent" icon={<UserRound />} allLabel="Any agent" value={filters.assignedMembershipId} disabled={pending}
        options={assignees.map(member => ({ value: member.id, label: member.userProfile?.displayName || member.email, hint: member.id === membership.id ? "You" : undefined }))} onChange={assignedMembershipId => apply({ assignedMembershipId })} />
      <FilterMenu testId="lead-filter-source" label="Source" icon={<Megaphone />} allLabel="Any source" value={filters.sourceId} disabled={pending}
        options={sources.map(source => ({ value: source.id, label: source.name }))} onChange={sourceId => apply({ sourceId })} />
      <FilterMenu testId="lead-filter-channel" label="Channel" icon={<Radio />} allLabel="Any channel" value={filters.channel} disabled={pending}
        options={LEAD_CHANNELS.map(channel => ({ value: channel, label: LEAD_CHANNEL_LABELS[channel] }))} onChange={channel => apply({ channel: channel as LeadFilters["channel"] })} />
      {(campaigns.length > 0 || filters.campaign) && <FilterMenu testId="lead-filter-campaign" label="Campaign" icon={<Target />} allLabel="Any campaign" value={filters.campaign} disabled={pending}
        options={[...campaigns.map(campaign => ({ value: campaign.key, label: campaign.label })), ...(filters.campaign && !campaigns.some(campaign => campaign.key === filters.campaign) ? [{ value: filters.campaign, label: filters.campaign }] : [])]}
        onChange={campaign => apply({ campaign })} />}
      <FilterMenu testId="lead-filter-priority" label="Priority" icon={<Flag />} allLabel="Any priority" value={filters.priority} disabled={pending}
        options={Object.entries(leadPriorityLabels).map(([value, label]) => ({ value, label, dot: PRIORITY_DOTS[value as keyof typeof PRIORITY_DOTS] }))} onChange={priority => apply({ priority: priority as LeadFilters["priority"] })} />
      {branches.length > 0 && <FilterMenu testId="lead-filter-branch" label="Branch" icon={<GitBranch />} allLabel="Any branch" value={filters.branchId} disabled={pending}
        options={branches.map(branch => ({ value: branch.id, label: branch.name }))} onChange={branchId => apply({ branchId })} />}
      <FilterMenu testId="lead-filter-follow-up" label="Follow-up" icon={<Clock />} allLabel="Any follow-up" value={filters.followUp === "ALL" ? "" : filters.followUp} disabled={pending}
        options={[{ value: "OVERDUE", label: "Overdue" }, { value: "UPCOMING", label: "Upcoming" }]} onChange={followUp => apply({ followUp: (followUp || "ALL") as LeadFilters["followUp"] })} />
      {active > 0 && <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-muted-foreground" disabled={pending} onClick={() => { setSearch(""); onChange({ search: "", status: "", assignedMembershipId: "", sourceId: "", priority: "", branchId: "", channel: "", campaign: "", followUp: "ALL", page: 1 }); }}>
        <X aria-hidden="true" />Clear filters<span className="tabular-nums">({active})</span>
      </Button>}
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending} data-testid="lead-sort" render={<Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" aria-label={`Sort: ${leadSortLabels[filters.sort]}`} />}>
        <ArrowDownUp aria-hidden="true" />{leadSortLabels[filters.sort]}<ChevronDown className="size-3 opacity-50" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={filters.sort} onValueChange={value => apply({ sort: value as LeadFilters["sort"] })}>
            {Object.entries(leadSortLabels).map(([value, label]) => <DropdownMenuRadioItem key={value} value={value}>{label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}
