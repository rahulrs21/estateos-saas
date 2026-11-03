"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck2, Check, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { automationsGet, automationsSend, dateTime, errorMessage, type MyTasks } from "../client";

/*
 * My tasks: the member's pending lead follow-ups and work tasks (including
 * those workflows created), plus the team queue for managers. Completing a
 * follow-up uses the existing lead endpoint; both emit task.completed.
 */

interface Row {key: string; kind: "FOLLOW_UP" | "WORK_TASK"; id: string; title: string; dueAt: string; context: string; href: string | null; queue: boolean; leadId?: string}

export function MyTasksView({organizationId}: {organizationId: string}) {
  const [data, setData] = useState<(MyTasks & {loadedAt: number}) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => automationsGet<MyTasks>("/api/tasks", "Your tasks could not be loaded.")
    .then(tasks => { setData({...tasks, loadedAt: Date.now()}); setError(null); }, cause => setError(errorMessage(cause, "Your tasks could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);

  if (error && !data) return <EmptyState icon={AlertTriangle} title="Tasks could not be loaded" description={error}><Button variant="outline" onClick={() => void load()}>Try again</Button></EmptyState>;
  if (!data) return <PageSkeleton />;
  const rows: Row[] = [
    ...data.followUps.map(row => ({key: `f-${row.id}`, kind: "FOLLOW_UP" as const, id: row.id, title: row.title, dueAt: row.dueAt, context: row.lead?.fullName ?? "Lead", href: `/leads/${row.leadId}`, queue: false, leadId: row.leadId})),
    ...data.workTasks.map(row => ({key: `w-${row.id}`, kind: "WORK_TASK" as const, id: row.id, title: row.title, dueAt: row.dueAt,
      context: row.listing ? `Listing ${row.listing.listingReference ?? ""} ${row.listing.title ?? ""}`.trim() : "Team task", href: row.listingId ? `/listings/${row.listingId}` : null, queue: !row.assignedMembershipId})),
  ].sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const now = data.loadedAt;

  const complete = async (row: Row) => {
    setBusy(row.key);
    try {
      if (row.kind === "FOLLOW_UP") await automationsSend(`/api/leads/${row.leadId}/follow-ups/${row.id}/complete`, organizationId, "POST", {}, "The follow-up could not be completed.");
      else await automationsSend(`/api/tasks/work/${row.id}/complete`, organizationId, "POST", {}, "The task could not be completed.");
      toast.success("Task completed.");
      await load();
    } catch (cause) { toast.error(errorMessage(cause, "The task could not be completed.")); } finally { setBusy(null); }
  };

  return <section className="space-y-3" aria-labelledby="tasks-title">
    <div className="flex items-center justify-between gap-2">
      <h2 id="tasks-title" className="font-semibold">Open tasks <span className="text-muted-foreground">({rows.length})</span></h2>
      <Button size="sm" variant="ghost" onClick={() => void load()}><RefreshCw aria-hidden="true" />Refresh</Button>
    </div>
    {rows.length === 0
      ? <div className="rounded-xl border bg-card"><EmptyState icon={CalendarCheck2} title="Nothing open" description="Follow-ups you schedule and tasks workflows create for you appear here." /></div>
      : <ul className="divide-y rounded-xl border bg-card">{rows.map(row => {
        const overdue = Date.parse(row.dueAt) < now;
        return <li key={row.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 font-medium">{row.title}
              <Badge variant="outline">{row.kind === "FOLLOW_UP" ? "Follow-up" : "Work task"}</Badge>
              {row.queue && <Badge variant="secondary">Team queue</Badge>}
              {overdue && <Badge variant="destructive">Overdue</Badge>}</p>
            <p className="text-sm text-muted-foreground">{row.href ? <Link className="hover:underline" href={row.href}>{row.context}</Link> : row.context} · due {dateTime(row.dueAt)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void complete(row)} disabled={busy === row.key} aria-label={`Complete ${row.title}`}>
            {busy === row.key ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}Complete</Button>
        </li>;
      })}</ul>}
  </section>;
}
