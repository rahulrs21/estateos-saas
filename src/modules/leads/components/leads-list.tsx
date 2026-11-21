"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore, useTransition, type MouseEvent } from "react";
import { ArrowRight, CalendarClock, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleDot, Columns3, List, Loader2, Mail, Phone, Sparkles, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LeadFilters, LeadListData, LeadRecord } from "../types";
import { cn } from "@/lib/utils";
import { avatarTone, leadBudget, leadInitials, leadPriorityLabels, leadsHref } from "../presentation";
import { LeadEditorDialog } from "./lead-form";
import { LeadFilterBar } from "./lead-filter-bar";
import { LeadsKanban } from "./leads-kanban";
import { formatLeadDate, LeadStatusBadge, leadStatusLabels } from "./lead-ui";

export function LeadPriority({ priority = "NORMAL" }: { priority?: LeadRecord["priority"] }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", priority === "URGENT" ? "text-destructive" : priority === "HIGH" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}><span className={cn("size-1.5 rounded-full", priority === "URGENT" ? "bg-destructive" : priority === "HIGH" ? "bg-amber-500" : priority === "LOW" ? "bg-slate-400" : "bg-primary/60")} aria-hidden="true" />{leadPriorityLabels[priority]}</span>;
}

export function LeadAvatar({ name, className }: { name: string; className?: string }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", avatarTone(name), className)} aria-hidden="true">{leadInitials(name) || "?"}</span>;
}

function LeadIdentity({ lead }: { lead: LeadRecord }) {
  return <div className="flex min-w-0 items-center gap-3"><LeadAvatar name={lead.fullName} /><div className="min-w-0"><Link href={`/leads/${lead.id}`} className="block truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">{lead.fullName}</Link>
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-normal text-muted-foreground">{lead.email ? <Mail className="size-3 shrink-0" aria-hidden="true" /> : lead.phone ? <Phone className="size-3 shrink-0" aria-hidden="true" /> : null}<span className="truncate">{lead.email || lead.phone || "No contact details"}</span></span></div></div>;
}

function AgentCell({ lead }: { lead: LeadRecord }) {
  const name = lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email;
  if (!name) return <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">Unassigned</span>;
  return <span className="flex min-w-0 items-center gap-2"><LeadAvatar name={name} className="size-6 text-[10px]" /><span className="truncate text-xs">{name}</span></span>;
}

// "Now", read only in the browser after hydration (0 on the server), so the overdue
// highlight never makes the server and browser markup differ.
const subscribeNever = () => () => {};
let loadedAt = 0;
const useClientNow = () => useSyncExternalStore(subscribeNever, () => (loadedAt ||= Date.now()), () => 0);

function FollowUp({ value, now }: { value?: string | null; now: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">Not scheduled</span>;
  const overdue = now > 0 && new Date(value).getTime() < now;
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}><CalendarClock className="size-3.5" aria-hidden="true" /><time dateTime={value}>{formatLeadDate(value, true)}</time>{overdue && <span className="sr-only">(overdue)</span>}</span>;
}

function SortHeader({ label, sorts, filters, onSort }: { label: string; sorts: [LeadFilters["sort"], LeadFilters["sort"]]; filters: LeadFilters; onSort: (sort: LeadFilters["sort"]) => void }) {
  const current = sorts.indexOf(filters.sort);
  return <button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", current >= 0 && "text-foreground")} onClick={() => onSort(current === 0 ? sorts[1] : sorts[0])} aria-label={`Sort by ${label.toLowerCase()}`}>
    <span>{label}</span><ChevronDown className={cn("size-3 transition-transform", current < 0 && "opacity-40", current === 0 && sorts[0].endsWith("_ASC") && "rotate-180", current === 1 && sorts[1].endsWith("_ASC") && "rotate-180")} aria-hidden="true" />
  </button>;
}

export function LeadsList({ data }: { data: LeadListData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = useClientNow();
  const { organization, sources, filters, leads, hasNext, total, metrics } = data;
  const hasFilters = Boolean(filters.search || filters.status || filters.branchId || filters.assignedMembershipId || filters.sourceId || filters.priority || filters.createdFrom || filters.createdTo || filters.followUp !== "ALL");
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const navigate = (changes: Partial<LeadFilters>) => startTransition(() => router.push(leadsHref(filters, changes), { scroll: false }));
  const sourceName = (lead: LeadRecord) => sources.find(source => source.id === lead.sourceId)?.name || lead.source || "Not specified";
  // A click anywhere on a row opens the lead, except on its own links and buttons.
  const openRow = (event: MouseEvent, id: string) => { if (!(event.target as HTMLElement).closest("a,button,input,select")) router.push(`/leads/${id}`); };

  const metricCards = [
    { label: "Total leads", value: metrics.total, icon: UsersRound, note: "All permitted active leads", status: "" as const, tone: "text-primary bg-primary/10", bar: "bg-primary" },
    { label: "New leads", value: metrics.new, icon: Sparkles, note: "Ready for a first conversation", status: "NEW" as const, tone: "text-blue-600 bg-blue-500/10 dark:text-blue-300", bar: "bg-blue-500" },
    { label: "Qualified leads", value: metrics.qualified, icon: CircleDot, note: "Opportunities with a clear fit", status: "QUALIFIED" as const, tone: "text-violet-600 bg-violet-500/10 dark:text-violet-300", bar: "bg-violet-500" },
    { label: "Won leads", value: metrics.won, icon: CheckCheck, note: "Won and legacy converted leads", status: "WON" as const, tone: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300", bar: "bg-emerald-500" },
  ];

  return <div className="space-y-6" aria-busy={pending}>
    <PageHeader title="Leads" eyebrow={organization.name} description="Build relationships. Move every opportunity forward.">
      <LeadEditorDialog data={data} />
    </PageHeader>

    <section aria-label="Lead overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metricCards.map(metric => {
        const selected = metric.status ? filters.status === metric.status : !filters.status;
        const share = metrics.total ? Math.round(metric.value / metrics.total * 100) : 0;
        return <Link key={metric.label} href={leadsHref(filters, { status: metric.status, page: 1 })} scroll={false} aria-current={selected ? "true" : undefined}
          className={cn("group rounded-xl border bg-card p-4 shadow-xs outline-none transition-shadow hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5", selected && "border-primary/40 ring-2 ring-primary/15")}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-medium text-muted-foreground">{metric.label}</h2><span className={cn("flex size-8 items-center justify-center rounded-lg", metric.tone)}><metric.icon className="size-4" aria-hidden="true" /></span></div>
          <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{metric.value.toLocaleString("en-GB")}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true"><div className={cn("h-full rounded-full", metric.bar)} style={{ width: `${metric.status ? share : 100}%` }} /></div>
          <p className="mt-2 hidden text-[11px] leading-5 text-muted-foreground sm:block">{metric.status ? `${share}% of all leads · ` : ""}{metric.note}</p>
        </Link>;
      })}
    </section>

    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
        <div><h2 className="text-sm font-semibold">{hasFilters ? "Filtered leads" : "All leads"}<span className="ml-2 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{total.toLocaleString("en-GB")}</span></h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{data.canManageAssignments ? "Company leads in your active workspace." : "Only the leads your membership allows."}{filters.view === "KANBAN" ? " The board shows this page only." : ""}</p></div>
        <div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1" role="group" aria-label="Lead view"><Button variant={filters.view === "LIST" ? "secondary" : "ghost"} size="sm" className="h-7" aria-pressed={filters.view === "LIST"} disabled={pending} onClick={() => navigate({view:"LIST"})}><List aria-hidden="true" />List</Button><Button variant={filters.view === "KANBAN" ? "secondary" : "ghost"} size="sm" className="h-7" aria-pressed={filters.view === "KANBAN"} disabled={pending} onClick={() => navigate({view:"KANBAN"})}><Columns3 aria-hidden="true" />Kanban</Button></div>
      </div>

      <LeadFilterBar key={JSON.stringify(filters)} data={data} pending={pending} onChange={navigate} />

      {filters.view === "KANBAN" ? <LeadsKanban key={`${organization.id}:${JSON.stringify(filters)}`} data={data} /> : leads.length === 0 ? <EmptyState icon={UsersRound} title={hasFilters || filters.page > 1 ? "No leads match this view" : "Your next relationship starts here"} description={hasFilters || filters.page > 1 ? "Adjust your filters or return to the first page." : "Create a lead to capture an inquiry, assign an agent and plan the next conversation."} className="min-h-80">{hasFilters || filters.page > 1 ? <Link href={`/leads?view=${filters.view}`} className={buttonVariants({variant:"outline"})}>Clear filters</Link> : <LeadEditorDialog data={data}>Create your first lead</LeadEditorDialog>}</EmptyState> : <>
        <ul className="divide-y md:hidden">{leads.map(lead => <li key={lead.id} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3"><LeadIdentity lead={lead} /><LeadStatusBadge status={lead.status} /></div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 rounded-lg bg-muted/40 p-3 text-xs">
            <div><dt className="text-[11px] text-muted-foreground">Agent</dt><dd className="mt-1"><AgentCell lead={lead} /></dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Priority</dt><dd className="mt-1"><LeadPriority priority={lead.priority} /></dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Budget</dt><dd className="mt-1 truncate tabular-nums">{leadBudget(lead)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Next follow-up</dt><dd className="mt-1"><FollowUp value={lead.followUpAt} now={now} /></dd></div>
          </dl>
          <div className="flex items-center justify-between text-xs"><span className="rounded-md border bg-background px-2 py-0.5 text-muted-foreground">{sourceName(lead)}</span><Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary">View lead<ArrowRight className="size-3.5" aria-hidden="true" /></Link></div>
        </li>)}</ul>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Authorized leads for {organization.name}</caption>
          <thead className="border-b bg-muted/30 text-[11px] font-medium tracking-wide text-muted-foreground uppercase [&_button]:uppercase"><tr>
            <th scope="col" className="min-w-64 px-5 py-3 font-medium"><SortHeader label="Lead" sorts={["NAME_ASC", "NAME_DESC"]} filters={filters} onSort={sort => navigate({ sort, page: 1 })} /></th>
            <th scope="col" className="px-4 py-3 font-medium">Stage</th>
            <th scope="col" className="px-4 py-3 font-medium">Priority</th>
            <th scope="col" className="min-w-40 px-4 py-3 font-medium">Agent</th>
            <th scope="col" className="px-4 py-3 font-medium">Source</th>
            <th scope="col" className="min-w-40 px-4 py-3 font-medium">Budget</th>
            <th scope="col" className="min-w-40 px-4 py-3 font-medium"><button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", filters.sort === "FOLLOW_UP_ASC" && "text-foreground")} onClick={() => navigate({sort:"FOLLOW_UP_ASC",page:1})}>Follow-up<ChevronDown className={cn("size-3 rotate-180", filters.sort !== "FOLLOW_UP_ASC" && "opacity-40")} aria-hidden="true" /></button></th>
            <th scope="col" className="px-4 py-3 font-medium"><SortHeader label="Created" sorts={["CREATED_DESC", "CREATED_ASC"]} filters={filters} onSort={sort => navigate({ sort, page: 1 })} /></th>
            <th scope="col"><span className="sr-only">Open lead</span></th>
          </tr></thead>
          <tbody className="divide-y">{leads.map(lead => <tr key={lead.id} onClick={event => openRow(event, lead.id)} className="group cursor-pointer transition-colors hover:bg-muted/40" data-testid="lead-row">
            <th scope="row" className="max-w-80 px-5 py-3.5 font-normal"><LeadIdentity lead={lead} /></th>
            <td className="px-4 py-3.5"><LeadStatusBadge status={lead.status} />{lead.pipelineStage && lead.pipelineStage.name !== leadStatusLabels[lead.status] && <p className="mt-1 text-[11px] text-muted-foreground">{lead.pipelineStage.name}</p>}</td>
            <td className="px-4 py-3.5"><LeadPriority priority={lead.priority} /></td>
            <td className="max-w-48 px-4 py-3.5"><AgentCell lead={lead} /></td>
            <td className="whitespace-nowrap px-4 py-3.5"><span className="rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground">{sourceName(lead)}</span></td>
            <td className="px-4 py-3.5 text-xs font-medium tabular-nums">{leadBudget(lead)}</td>
            <td className="px-4 py-3.5"><FollowUp value={lead.followUpAt} now={now} /></td>
            <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground"><time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt)}</time></td>
            <td className="pr-4"><Link href={`/leads/${lead.id}`} aria-label={`Open ${lead.fullName}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-60 transition group-hover:bg-background group-hover:text-primary group-hover:opacity-100 hover:bg-muted"><ArrowRight className="size-4" aria-hidden="true" /></Link></td>
          </tr>)}</tbody></table></div>
      </>}

      <nav aria-label="Lead list pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="tabular-nums">{total && leads.length ? `${(filters.page - 1) * filters.pageSize + 1}–${Math.min(filters.page * filters.pageSize, total)} of ${total.toLocaleString("en-GB")}` : "No results on this page"}</span>
          <DropdownMenu>
            <DropdownMenuTrigger disabled={pending} render={<Button variant="ghost" size="xs" className="text-muted-foreground" aria-label={`Leads per page: ${filters.pageSize}`} />}>{filters.pageSize} per page<ChevronDown aria-hidden="true" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuRadioGroup value={String(filters.pageSize)} onValueChange={value => navigate({ pageSize: Number(value), page: 1 })}>
                {[10, 25, 50].map(size => <DropdownMenuRadioItem key={size} value={String(size)}>{size} per page</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={pending || filters.page <= 1} onClick={() => navigate({page:filters.page-1})}><ChevronLeft aria-hidden="true" />Previous</Button><span className="px-1 text-xs tabular-nums" aria-current="page">{filters.page} / {pageCount}</span><Button variant="outline" size="sm" disabled={pending || !hasNext} onClick={() => navigate({page:filters.page+1})}>Next<ChevronRight aria-hidden="true" /></Button></div>
      </nav>
    </Card>
    <p role="status" className="flex items-center gap-2 text-[11px] text-muted-foreground">{pending ? <><Loader2 className="size-3 animate-spin" aria-hidden="true" />Loading your lead view…</> : "Dates are shown in Dubai time. Date filters use UTC calendar days."}</p>
  </div>;
}
