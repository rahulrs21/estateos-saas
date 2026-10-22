import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const leadStatusLabels = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  VIEWING_SCHEDULED: "Viewing Scheduled",
  VIEWING_COMPLETED: "Viewing Completed",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  CONVERTED: "Converted",
  LOST: "Lost",
} as const;

export const leadStatusOptions = ["NEW", "CONTACTED", "QUALIFIED", "VIEWING_SCHEDULED", "VIEWING_COMPLETED", "NEGOTIATION", "WON", "LOST", "CONVERTED"] as const;

const statusClasses = {
  NEW: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  CONTACTED: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  QUALIFIED: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  VIEWING_SCHEDULED: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  VIEWING_COMPLETED: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  NEGOTIATION: "border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  WON: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  CONVERTED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  LOST: "border-border bg-muted text-muted-foreground",
};

export function LeadStatusBadge({ status }: { status: keyof typeof leadStatusLabels }) {
  return <Badge variant="outline" className={cn("gap-1.5 px-2.5 py-1 text-[11px] font-medium", statusClasses[status])}><span className="size-1.5 rounded-full bg-current" aria-hidden="true" />{leadStatusLabels[status]}</Badge>;
}

export const selectClassName = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive";
export const textareaClassName = "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive";

export function LeadField({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id} className="text-xs font-medium">{label}</Label>{children}{error ? <p id={`${id}-message`} className="text-xs text-destructive">{error}</p> : hint ? <p id={`${id}-message`} className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}</div>;
}

export function LeadFormMessage({ message, success = false }: { message: string; success?: boolean }) {
  if (!message) return null;
  return <p role={success ? "status" : "alert"} className={cn("rounded-lg border px-4 py-3 text-sm leading-6", success ? "border-primary/20 bg-primary/5 text-primary" : "border-destructive/20 bg-destructive/5 text-destructive")}>{message}</p>;
}

export function formatLeadDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } as const : {}),
  }).format(date);
}

/** datetime-local controls are displayed in Dubai time, regardless of browser locale. */
export function toDubaiDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16) : "";
}

export function fromDubaiDateTimeInput(value: string) {
  if (!value) return null;
  const date = new Date(`${value}:00+04:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}
