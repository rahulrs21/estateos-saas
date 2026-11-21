"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent } from "react";
import { ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, Columns3, List, Loader2, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { LeadFilters, LeadListData, LeadRecord } from "../types";
import { cn } from "@/lib/utils";
import { leadBudget, leadDateRangeLabels, leadPriorityLabels, leadsHref } from "../presentation";
import { LeadEditorDialog } from "./lead-form";
import { LeadDateRangeMenu, LeadFilterBar } from "./lead-filter-bar";
import { LeadsKanban } from "./leads-kanban";
import { formatLeadDate, LeadAvatar, LeadStatusBadge, leadStatusLabels } from "./lead-ui";
import { useClientNow } from "./use-client-now";

export function LeadPriority({ priority = "NORMAL" }: { priority?: LeadRecord["priority"] }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", priority === "URGENT" ? "font-medium text-red-600 dark:text-red-400" : priority === "HIGH" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground")}><span className={cn("size-1.5 rounded-full", priority === "URGENT" ? "bg-red-500" : priority === "HIGH" ? "bg-amber-500" : "bg-slate-400")} aria-hidden="true" />{leadPriorityLabels[priority]}</span>;
}

function LeadIdentity({ lead }: { lead: LeadRecord }) {
  return <div className="flex min-w-0 items-center gap-2.5"><LeadAvatar name={lead.fullName} /><div className="min-w-0"><Link href={`/leads/${lead.id}`} className="block truncate text-sm font-medium text-foreground hover:underline">{lead.fullName}</Link>
    <span className="block truncate text-xs text-muted-foreground">{lead.email || lead.phone || "No contact details"}</span></div></div>;
}

function agentName(lead: LeadRecord) {
  return lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || null;
}

function FollowUp({ value, now }: { value?: string | null; now: number }) {
  if (!value) return <span className="text-xs text-muted-foreground/70">—</span>;
  const overdue = now > 0 && new Date(value).getTime() < now;
  return <span className={cn("whitespace-nowrap text-xs", overdue ? "font-medium text-red-600 dark:text-red-400" : "text-foreground/80")}><time dateTime={value}>{formatLeadDate(value, true)}</time>{overdue && <span className="ml-1.5 rounded bg-red-500/10 px-1 py-px text-[10px]">Overdue</span>}</span>;
}

function SortHeader({ label, sorts, filters, onSort }: { label: string; sorts: [LeadFilters["sort"], LeadFilters["sort"]]; filters: LeadFilters; onSort: (sort: LeadFilters["sort"]) => void }) {
  const current = sorts.indexOf(filters.sort);
  return <button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", current >= 0 && "text-foreground")} onClick={() => onSort(current === 0 ? sorts[1] : sorts[0])} aria-label={`Sort by ${label.toLowerCase()}`}>
    {label}<ArrowUpDown className={cn("size-3", current < 0 && "opacity-40")} aria-hidden="true" />
  </button>;
}

function emptyRangeText(range: LeadFilters["range"]) {
  if (range === "TODAY") return "No leads were created today.";
  if (range === "YESTERDAY") return "No leads were created yesterday.";
  if (range === "CUSTOM") return "No leads were created in this date range.";
  return `No leads were created in the ${leadDateRangeLabels[range].toLowerCase()}.`;
}

export function LeadsList({ data }: { data: LeadListData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const now = useClientNow();
  const { organization, sources, filters, leads, hasNext, total, metrics } = data;
  const hasFilters = Boolean(filters.search || filters.status || filters.branchId || filters.assignedMembershipId || filters.sourceId || filters.priority || filters.followUp !== "ALL");
  const dated = filters.range !== "ALL";
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const navigate = (changes: Partial<LeadFilters>) => startTransition(() => router.push(leadsHref(filters, changes), { scroll: false }));
  const sourceName = (lead: LeadRecord) => sources.find(source => source.id === lead.sourceId)?.name || lead.source || "—";
  // A click anywhere on a row opens the lead, except on its own links and buttons.
  const openRow = (event: MouseEvent, id: string) => { if (!(event.target as HTMLElement).closest("a,button,input,select")) router.push(`/leads/${id}`); };

  const metricCards = [
    { label: "Total leads", value: metrics.total, status: "" as const },
    { label: "New leads", value: metrics.new, status: "NEW" as const },
    { label: "Qualified leads", value: metrics.qualified, status: "QUALIFIED" as const },
    { label: "Won leads", value: metrics.won, status: "WON" as const },
  ];

  return <div className="space-y-4" aria-busy={pending}>
    <PageHeader title="Leads" eyebrow={organization.name} description="Every enquiry and opportunity in your workspace.">
      <LeadEditorDialog data={data} />
    </PageHeader>

    {/* Totals across all active leads (not the date range); each one filters by its status. */}
    <section aria-label="Lead overview" className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {metricCards.map((metric, index) => {
        const selected = metric.status ? filters.status === metric.status : !filters.status;
        const share = metrics.total ? Math.round(metric.value / metrics.total * 100) : 0;
        return <Link key={metric.label} href={leadsHref(filters, { status: metric.status, page: 1 })} scroll={false} aria-current={selected ? "true" : undefined}
          className={cn("relative px-4 py-3 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/60", index % 2 === 1 && "border-l", index >= 2 && "border-t lg:border-t-0", index === 2 && "lg:border-l", selected && "bg-muted/40")}>
          {selected && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" aria-hidden="true" />}
          <h2 className="text-xs text-muted-foreground">{metric.label}</h2>
          <p className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-semibold tracking-tight tabular-nums">{metric.value.toLocaleString("en-GB")}</span>{metric.status && <span className="text-xs text-muted-foreground tabular-nums">{share}%</span>}</p>
        </Link>;
      })}
    </section>

    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-md border bg-muted/40 p-0.5" role="group" aria-label="Lead view">
            <Button variant="ghost" size="sm" className={cn("h-7 px-2.5 text-xs", filters.view === "LIST" ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground")} aria-pressed={filters.view === "LIST"} disabled={pending} onClick={() => navigate({view:"LIST"})}><List aria-hidden="true" />List</Button>
            <Button variant="ghost" size="sm" className={cn("h-7 px-2.5 text-xs", filters.view === "KANBAN" ? "bg-background text-foreground shadow-xs hover:bg-background" : "text-muted-foreground")} aria-pressed={filters.view === "KANBAN"} disabled={pending} onClick={() => navigate({view:"KANBAN"})}><Columns3 aria-hidden="true" />Kanban</Button>
          </div>
          <p className="text-xs text-muted-foreground" role="status"><span className="font-medium text-foreground tabular-nums">{total.toLocaleString("en-GB")}</span> {total === 1 ? "lead" : "leads"}{pending && <Loader2 className="ml-2 inline size-3 animate-spin" aria-label="Loading" />}</p>
        </div>
        <LeadDateRangeMenu key={`${filters.range}:${filters.createdFrom}:${filters.createdTo}`} filters={filters} pending={pending} onChange={navigate} />
      </div>

      <LeadFilterBar key={JSON.stringify(filters)} data={data} pending={pending} onChange={navigate} />

      {filters.view === "KANBAN" ? <LeadsKanban key={`${organization.id}:${JSON.stringify(filters)}`} data={data} /> : leads.length === 0
        ? <EmptyState icon={UsersRound} title={hasFilters || filters.page > 1 || dated ? "No leads in this view" : "No leads yet"}
          description={hasFilters || filters.page > 1 ? "Change the filters or the date range." : dated ? `${emptyRangeText(filters.range)} Try a longer date range.` : "Create a lead to capture an enquiry, assign an agent and plan the next conversation."} className="min-h-72">
          {hasFilters || filters.page > 1 ? <Link href={`/leads?view=${filters.view}&range=${filters.range}`} className={buttonVariants({variant:"outline", size: "sm"})}>Clear filters</Link>
            : dated ? <Button variant="outline" size="sm" onClick={() => navigate({ range: "ALL", createdFrom: "", createdTo: "", page: 1 })}>Show all time</Button>
            : <LeadEditorDialog data={data}>Create your first lead</LeadEditorDialog>}
        </EmptyState>
        : <>
        <ul className="divide-y md:hidden">{leads.map(lead => <li key={lead.id}>
          <Link href={`/leads/${lead.id}`} className="block space-y-2 px-3 py-3 active:bg-muted/50">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2.5"><LeadAvatar name={lead.fullName} /><div className="min-w-0"><p className="truncate text-sm font-medium">{lead.fullName}</p><p className="truncate text-xs text-muted-foreground">{lead.email || lead.phone || "No contact details"}</p></div></div><LeadStatusBadge status={lead.status} /></div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-[42px] text-xs text-muted-foreground"><LeadPriority priority={lead.priority} /><span className="tabular-nums text-foreground/80">{leadBudget(lead)}</span><span>{agentName(lead) ?? "Unassigned"}</span>{lead.followUpAt && <FollowUp value={lead.followUpAt} now={now} />}</div>
          </Link>
        </li>)}</ul>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Authorized leads for {organization.name}</caption>
          <thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr>
            <th scope="col" className="min-w-60 px-3 py-2 font-medium"><SortHeader label="Lead" sorts={["NAME_ASC", "NAME_DESC"]} filters={filters} onSort={sort => navigate({ sort, page: 1 })} /></th>
            <th scope="col" className="px-3 py-2 font-medium">Stage</th>
            <th scope="col" className="px-3 py-2 font-medium">Priority</th>
            <th scope="col" className="min-w-36 px-3 py-2 font-medium">Agent</th>
            <th scope="col" className="px-3 py-2 font-medium">Source</th>
            <th scope="col" className="min-w-36 px-3 py-2 font-medium">Budget</th>
            <th scope="col" className="min-w-36 px-3 py-2 font-medium"><button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", filters.sort === "FOLLOW_UP_ASC" && "text-foreground")} onClick={() => navigate({sort:"FOLLOW_UP_ASC",page:1})}>Follow-up<ArrowUpDown className={cn("size-3", filters.sort !== "FOLLOW_UP_ASC" && "opacity-40")} aria-hidden="true" /></button></th>
            <th scope="col" className="px-3 py-2 font-medium"><SortHeader label="Created" sorts={["CREATED_DESC", "CREATED_ASC"]} filters={filters} onSort={sort => navigate({ sort, page: 1 })} /></th>
          </tr></thead>
          <tbody className="divide-y">{leads.map(lead => <tr key={lead.id} onClick={event => openRow(event, lead.id)} className="cursor-pointer transition-colors hover:bg-muted/40" data-testid="lead-row">
            <th scope="row" className="max-w-80 px-3 py-2 font-normal"><LeadIdentity lead={lead} /></th>
            <td className="px-3 py-2"><LeadStatusBadge status={lead.status} />{lead.pipelineStage && lead.pipelineStage.name !== leadStatusLabels[lead.status] && <p className="mt-0.5 text-[11px] text-muted-foreground">{lead.pipelineStage.name}</p>}</td>
            <td className="px-3 py-2"><LeadPriority priority={lead.priority} /></td>
            <td className="max-w-44 truncate px-3 py-2 text-xs">{agentName(lead) ?? <span className="text-muted-foreground">Unassigned</span>}</td>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{sourceName(lead)}</td>
            <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums">{leadBudget(lead)}</td>
            <td className="px-3 py-2"><FollowUp value={lead.followUpAt} now={now} /></td>
            <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground"><time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt)}</time></td>
          </tr>)}</tbody></table></div>
      </>}

      <nav aria-label="Lead list pagination" className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{total && leads.length ? `${(filters.page - 1) * filters.pageSize + 1}–${Math.min(filters.page * filters.pageSize, total)} of ${total.toLocaleString("en-GB")}` : "0 results"}</span>
          <DropdownMenu>
            <DropdownMenuTrigger disabled={pending} render={<Button variant="ghost" size="xs" className="text-muted-foreground" aria-label={`Leads per page: ${filters.pageSize}`} />}>{filters.pageSize} per page<ChevronDown aria-hidden="true" /></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-32">
              <DropdownMenuRadioGroup value={String(filters.pageSize)} onValueChange={value => navigate({ pageSize: Number(value), page: 1 })}>
                {[10, 25, 50].map(size => <DropdownMenuRadioItem key={size} value={String(size)}>{size} per page</DropdownMenuRadioItem>)}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center gap-1"><Button variant="outline" size="sm" className="h-7 text-xs" disabled={pending || filters.page <= 1} onClick={() => navigate({page:filters.page-1})}><ChevronLeft aria-hidden="true" />Previous</Button><span className="px-2 text-xs tabular-nums text-muted-foreground" aria-current="page">{filters.page} / {pageCount}</span><Button variant="outline" size="sm" className="h-7 text-xs" disabled={pending || !hasNext} onClick={() => navigate({page:filters.page+1})}>Next<ChevronRight aria-hidden="true" /></Button></div>
      </nav>
    </div>
    <p className="text-[11px] text-muted-foreground">Dates are in Dubai time. The totals above cover all active leads; the list and board show the chosen date range.</p>
  </div>;
}
