"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { AlertTriangle, Check, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { classifyDue, type AgendaDue } from "@/modules/dashboard/dashboard-model";
import { automationsGet, automationsSend, errorMessage, type MyTasks } from "../client";

/*
 * My tasks: the member's pending lead follow-ups and work tasks (including
 * those workflows created), plus the team queue for managers. Completing a
 * follow-up uses the existing lead endpoint; both emit task.completed.
 * Tasks are grouped by when they are due, in the viewer's own time zone.
 */

type Kind = "FOLLOW_UP" | "WORK_TASK";
interface Row {key: string; kind: Kind; id: string; title: string; dueAt: string; due: AgendaDue; context: string; href: string | null; queue: boolean; leadId?: string}

type DueFilter = "ALL" | AgendaDue;
type TypeFilter = "ALL" | Kind | "QUEUE";

const GROUPS: Array<{due: AgendaDue; label: string}> = [
  {due: "OVERDUE", label: "Overdue"},
  {due: "TODAY", label: "Today"},
  {due: "THIS_WEEK", label: "Next 7 days"},
  {due: "LATER", label: "Later"},
];
const EMPTY: Record<DueFilter, string> = {
  ALL: "No open tasks match this filter.", OVERDUE: "Nothing overdue.", TODAY: "Nothing due today.",
  THIS_WEEK: "Nothing due in the next 7 days.", LATER: "Nothing scheduled further ahead.",
};
const EASE = [0.2, 0, 0, 1] as const;

const viewerTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const timeFormat = new Intl.DateTimeFormat("en-AE", {hour: "2-digit", minute: "2-digit", hour12: false});
const dayFormat = new Intl.DateTimeFormat("en-AE", {weekday: "short", day: "numeric", month: "short"});

function toRows(data: MyTasks, now: Date, timeZone: string): Row[] {
  return [
    ...data.followUps.map(row => ({key: `f-${row.id}`, kind: "FOLLOW_UP" as const, id: row.id, title: row.title, dueAt: row.dueAt,
      due: classifyDue(row.dueAt, now, timeZone), context: row.lead?.fullName ?? "Lead", href: `/leads/${row.leadId}`, queue: false, leadId: row.leadId})),
    ...data.workTasks.map(row => ({key: `w-${row.id}`, kind: "WORK_TASK" as const, id: row.id, title: row.title, dueAt: row.dueAt,
      due: classifyDue(row.dueAt, now, timeZone),
      context: row.listing ? `${row.listing.listingReference} · ${row.listing.title}` : "Team task",
      href: row.listingId ? `/listings/${row.listingId}` : null, queue: !row.assignedMembershipId})),
  ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || a.key.localeCompare(b.key));
}

/** "09:30" today; "Tue 18 Nov, 09:30" otherwise. */
function dueLabel(row: Row) {
  const date = new Date(row.dueAt);
  return row.due === "TODAY" ? timeFormat.format(date) : `${dayFormat.format(date)}, ${timeFormat.format(date)}`;
}

function overdueBy(dueAt: string, now: number) {
  const minutes = Math.max(1, Math.floor((now - Date.parse(dueAt)) / 60_000));
  if (minutes < 60) return `${minutes} min overdue`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h overdue`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} overdue`;
}

export function MyTasksView({organizationId}: {organizationId: string}) {
  const [data, setData] = useState<(MyTasks & {loadedAt: number}) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(true);
  const [completing, setCompleting] = useState<ReadonlySet<string>>(new Set());
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");

  const load = useCallback(() => automationsGet<MyTasks>("/api/tasks", "Your tasks could not be loaded.")
    .then(tasks => { setData({...tasks, loadedAt: Date.now()}); setError(null); }, cause => setError(errorMessage(cause, "Your tasks could not be loaded.")))
    .finally(() => setRefreshing(false)), []);
  useEffect(() => { void load(); }, [load]);
  const refresh = () => { setRefreshing(true); void load(); };

  const rows = useMemo(() => data ? toRows(data, new Date(data.loadedAt), viewerTimeZone()) : [], [data]);
  const hasQueue = rows.some(row => row.queue);
  const typed = rows.filter(row => typeFilter === "ALL" || (typeFilter === "QUEUE" ? row.queue : row.kind === typeFilter));
  const visible = typed.filter(row => dueFilter === "ALL" || row.due === dueFilter);
  const countOf = (due: DueFilter) => due === "ALL" ? typed.length : typed.filter(row => row.due === due).length;

  const complete = async (row: Row) => {
    setCompleting(current => new Set(current).add(row.key));
    try {
      if (row.kind === "FOLLOW_UP") await automationsSend(`/api/leads/${row.leadId}/follow-ups/${row.id}/complete`, organizationId, "POST", {}, "The follow-up could not be completed.");
      else await automationsSend(`/api/tasks/work/${row.id}/complete`, organizationId, "POST", {}, "The task could not be completed.");
      // Remove it locally so the row collapses at once; the list is then refreshed from the server.
      setData(current => current && {
        ...current,
        followUps: row.kind === "FOLLOW_UP" ? current.followUps.filter(item => item.id !== row.id) : current.followUps,
        workTasks: row.kind === "WORK_TASK" ? current.workTasks.filter(item => item.id !== row.id) : current.workTasks,
      });
      toast.success("Task completed.");
      void load();
    } catch (cause) {
      toast.error(errorMessage(cause, "The task could not be completed."));
    } finally {
      setCompleting(current => { const next = new Set(current); next.delete(row.key); return next; });
    }
  };

  if (error && !data) return <EmptyState icon={AlertTriangle} title="Tasks could not be loaded" description={error}><Button variant="outline" onClick={refresh}>Try again</Button></EmptyState>;
  if (!data) return <TasksSkeleton />;

  return <MotionConfig reducedMotion="user">
    <section className="space-y-3" aria-labelledby="tasks-title">
      <h2 id="tasks-title" className="sr-only">Open tasks</h2>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <FilterGroup label="Filter by due date" value={dueFilter} onChange={setDueFilter} options={[
          {value: "ALL", label: "All", count: countOf("ALL")},
          ...GROUPS.map(group => ({value: group.due, label: group.label, count: countOf(group.due), alert: group.due === "OVERDUE"})),
        ]} />
        <div className="flex items-center justify-between gap-2">
          <FilterGroup label="Filter by type" value={typeFilter} onChange={setTypeFilter} options={[
            {value: "ALL", label: "All types"}, {value: "FOLLOW_UP", label: "Follow-ups"}, {value: "WORK_TASK", label: "Work tasks"},
            ...(hasQueue ? [{value: "QUEUE" as const, label: "Team queue"}] : []),
          ]} />
          <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing} aria-label="Refresh tasks">
            <RefreshCw className={cn(refreshing && "animate-spin")} aria-hidden="true" /><span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error} Showing the last loaded list.</p>}

      {rows.length === 0
        ? <div className="rounded-xl border bg-card"><EmptyState icon={ListChecks} title="No open tasks" description="Follow-ups you schedule and tasks that workflows create for you appear here." /></div>
        : visible.length === 0
          ? <p className="rounded-xl border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground">{EMPTY[dueFilter]}</p>
          : <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
            {GROUPS.filter(group => dueFilter === "ALL" || dueFilter === group.due).map(group => {
              const items = visible.filter(row => row.due === group.due);
              if (!items.length) return null;
              return <div key={group.due} role="group" aria-label={`${group.label}, ${items.length}`}>
                <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className={cn(group.due === "OVERDUE" && "text-destructive")}>{group.label}</span>
                  <span className="tabular-nums">{items.length}</span>
                </div>
                <ul>
                  <AnimatePresence initial={false}>
                    {items.map(row => <TaskRow key={row.key} row={row} now={data.loadedAt} busy={completing.has(row.key)} onComplete={() => void complete(row)} />)}
                  </AnimatePresence>
                </ul>
              </div>;
            })}
          </div>}
    </section>
  </MotionConfig>;
}

function TaskRow({row, now, busy, onComplete}: {row: Row; now: number; busy: boolean; onComplete: () => void}) {
  return <motion.li layout="position" initial={{opacity: 0}} animate={{opacity: 1}}
    exit={{opacity: 0, height: 0, transition: {duration: 0.2, ease: EASE}}} transition={{duration: 0.15, ease: EASE}}
    className="overflow-hidden border-b last:border-b-0">
    <div className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30">
      <button type="button" onClick={onComplete} disabled={busy} aria-label={`Complete ${row.title}`}
        className={cn("mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-muted-foreground/50 text-primary-foreground transition-colors",
          "hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default",
          busy && "border-primary bg-primary")}>
        {busy
          ? <Check className="size-3" strokeWidth={3} aria-hidden="true" />
          : <Check className="size-3 text-primary opacity-0 transition-opacity group-hover:opacity-60" strokeWidth={3} aria-hidden="true" />}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium transition-colors", busy && "text-muted-foreground line-through")}>
          {row.href ? <Link href={row.href} className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{row.title}</Link> : row.title}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>{row.kind === "FOLLOW_UP" ? "Follow-up" : "Work task"}</span>
          <span aria-hidden="true">·</span>
          <span className="max-w-[40ch] truncate">{row.context}</span>
          {row.queue && <><span aria-hidden="true">·</span><span className="font-medium text-foreground">Team queue</span></>}
        </p>
      </div>
      <div className="shrink-0 text-right text-xs tabular-nums">
        <time dateTime={row.dueAt} className={cn(row.due === "OVERDUE" ? "text-destructive" : row.due === "TODAY" ? "text-foreground" : "text-muted-foreground")}>{dueLabel(row)}</time>
        {row.due === "OVERDUE" && <p className="mt-0.5 text-destructive/80">{overdueBy(row.dueAt, now)}</p>}
        {busy && <p className="mt-0.5 inline-flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Saving</p>}
      </div>
    </div>
  </motion.li>;
}

function FilterGroup<T extends string>({label, value, onChange, options}: {
  label: string; value: T; onChange: (value: T) => void; options: Array<{value: T; label: string; count?: number; alert?: boolean}>;
}) {
  return <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-card p-0.5 shadow-xs">
    {options.map(option => {
      const active = option.value === value;
      return <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(option.value)}
        className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          active && "text-foreground")}>
        {active && <motion.span layoutId={`${label}-active`} className="absolute inset-0 rounded-md bg-secondary" transition={{duration: 0.2, ease: EASE}} aria-hidden="true" />}
        <span className="relative">{option.label}</span>
        {option.count !== undefined && <span className={cn("relative tabular-nums", option.alert && option.count > 0 ? "text-destructive" : "text-muted-foreground")}>{option.count}</span>}
      </button>;
    })}
  </div>;
}

function TasksSkeleton() {
  return <div className="space-y-3" role="status" aria-label="Loading tasks">
    <div className="flex flex-wrap justify-between gap-2"><Skeleton className="h-8 w-96 max-w-full rounded-lg" /><Skeleton className="h-8 w-72 max-w-full rounded-lg" /></div>
    <div className="overflow-hidden rounded-xl border bg-card">
      {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="flex items-start gap-3 border-b px-4 py-3 last:border-b-0">
        <Skeleton className="mt-0.5 size-[18px] rounded-full" />
        <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-64 max-w-full" /></div>
        <Skeleton className="h-3 w-24" />
      </div>)}
    </div>
  </div>;
}
