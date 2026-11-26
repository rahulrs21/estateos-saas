"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { DASHBOARD_RANGES, MAX_CUSTOM_DAYS, inclusiveDays, type DashboardPeriod, type DashboardRange } from "../dashboard-model";

/*
 * Reporting period controls for the dashboard: a menu in the banner and
 * pills on the Lead performance card. Presets are plain links; a custom
 * range opens a dialog with two date fields. The period lives in the URL
 * (?range=… or ?range=custom&from=…&to=…), which the server validates again.
 */

const PRESETS = Object.keys(DASHBOARD_RANGES) as DashboardRange[];
const SHORT: Record<DashboardRange, string> = {today: "Today", "7d": "7D", "30d": "30D", "90d": "90D", "1y": "1Y"};
const presetLabel = (key: DashboardRange) => key === "today" ? "Today" : `Last ${DASHBOARD_RANGES[key].label}`;
const presetHref = (key: DashboardRange) => `/workspace/dashboard?range=${key}`;

function useCustomRange(period: DashboardPeriod, today: string) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState({from: period.from, to: period.to});
  const [error, setError] = useState("");
  const show = () => { setRange({from: period.from, to: period.to}); setError(""); setOpen(true); };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!range.from || !range.to) { setError("Choose a start date and an end date."); return; }
    if (range.from > range.to) { setError("The end date must be on or after the start date."); return; }
    if (range.to > today) { setError("The end date can't be after today."); return; }
    if (inclusiveDays(range.from, range.to) > MAX_CUSTOM_DAYS) { setError(`Choose at most ${MAX_CUSTOM_DAYS} days.`); return; }
    setOpen(false);
    router.push(`/workspace/dashboard?${new URLSearchParams({range: "custom", from: range.from, to: range.to})}`, {scroll: false});
  };
  const dialog = <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="sm:max-w-sm">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Custom date range</DialogTitle>
          <DialogDescription>Leads created between these days (Dubai time), both included. Up to {MAX_CUSTOM_DAYS} days.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="dashboard-from" className="text-xs">From</Label>
            <Input id="dashboard-from" type="date" value={range.from} max={range.to || today} onChange={event => setRange(value => ({...value, from: event.target.value}))} /></div>
          <div className="space-y-1.5"><Label htmlFor="dashboard-to" className="text-xs">To</Label>
            <Input id="dashboard-to" type="date" value={range.to} min={range.from || undefined} max={today} onChange={event => setRange(value => ({...value, to: event.target.value}))} /></div>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Apply</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
  return {show, dialog};
}

/** The banner's period menu: Today, the presets and a custom range. */
export function PeriodMenu({period, today, className}: {period: DashboardPeriod; today: string; className?: string}) {
  const custom = useCustomRange(period, today);
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className={cn("h-9 gap-1.5 rounded-full bg-card px-3.5 text-xs shadow-xs", className)} aria-label={`Reporting period: ${period.label}`} />}>
        {period.label}<ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {PRESETS.map(key => <DropdownMenuItem key={key} render={<Link href={presetHref(key)} scroll={false} />}>
          <span className="flex-1">{presetLabel(key)}</span>{period.key === key && <Check className="size-3.5 text-primary" aria-hidden="true" />}
        </DropdownMenuItem>)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={custom.show}>
          <CalendarDays aria-hidden="true" /><span className="flex-1">Custom range…</span>{period.key === "custom" && <Check className="size-3.5 text-primary" aria-hidden="true" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {custom.dialog}
  </>;
}

/** Period pills for a card header: Today, 7D, 30D, 90D, 1Y and Custom (showing its dates when active). */
export function PeriodPills({period, today}: {period: DashboardPeriod; today: string}) {
  const custom = useCustomRange(period, today);
  const pill = (active: boolean) => cn("rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
    active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground");
  return <>
    <nav aria-label="Reporting period" className="flex flex-wrap items-center justify-end gap-1">
      {PRESETS.map(key => <Link key={key} href={presetHref(key)} scroll={false} aria-current={period.key === key ? "page" : undefined} aria-label={presetLabel(key)} className={pill(period.key === key)}>
        {SHORT[key]}
      </Link>)}
      <button type="button" onClick={custom.show} aria-pressed={period.key === "custom"} className={cn(pill(period.key === "custom"), "inline-flex items-center gap-1")}>
        <CalendarDays className="size-3.5" aria-hidden="true" />{period.key === "custom" ? period.label : "Custom"}
      </button>
    </nav>
    {custom.dialog}
  </>;
}
