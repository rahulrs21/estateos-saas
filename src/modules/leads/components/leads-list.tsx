"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { ArrowDownUp, ArrowRight, CheckCheck, ChevronLeft, ChevronRight, CircleDot, Columns3, List, Loader2, Search, SlidersHorizontal, Sparkles, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadFilters, LeadListData, LeadRecord } from "../types";
import { cn } from "@/lib/utils";
import { leadBudget, leadInitials, leadPriorityLabels, leadSortLabels, leadsHref } from "../presentation";
import { LeadEditorDialog } from "./lead-form";
import { LeadsKanban } from "./leads-kanban";
import { formatLeadDate, LeadStatusBadge, leadStatusLabels, leadStatusOptions, selectClassName } from "./lead-ui";

export function LeadPriority({ priority = "NORMAL" }: { priority?: LeadRecord["priority"] }) {
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs", priority === "URGENT" ? "text-destructive" : priority === "HIGH" ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}><span className={cn("size-1.5 rounded-full", priority === "URGENT" ? "bg-destructive" : priority === "HIGH" ? "bg-amber-500" : priority === "LOW" ? "bg-slate-400" : "bg-primary/60")} aria-hidden="true" />{leadPriorityLabels[priority]}</span>;
}

function LeadIdentity({ lead }: { lead: LeadRecord }) {
  return <div className="flex min-w-0 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-xs font-semibold text-primary" aria-hidden="true">{leadInitials(lead.fullName)}</span><div className="min-w-0"><Link href={`/leads/${lead.id}`} className="block truncate font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline">{lead.fullName}</Link><span className="mt-1 block truncate text-xs font-normal text-muted-foreground">{lead.email || lead.phone || "No contact details"}</span></div></div>;
}

export function LeadsList({ data }: { data: LeadListData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterError, setFilterError] = useState("");
  const { organization, membership, branches, assignees, sources, filters, leads, hasNext, total, metrics } = data;
  const hasFilters = Boolean(filters.search || filters.status || filters.branchId || filters.assignedMembershipId || filters.sourceId || filters.priority || filters.createdFrom || filters.createdTo || filters.followUp !== "ALL");
  const pageCount = Math.max(1, Math.ceil(total / filters.pageSize));
  const navigate = (changes: Partial<LeadFilters>) => startTransition(() => router.push(leadsHref(filters, changes), { scroll: false }));

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const from = String(values.createdFrom || ""), to = String(values.createdTo || "");
    if (from && to && from > to) { setFilterError("The end date must be on or after the start date."); return; }
    setFilterError("");
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) if (value !== "") query.set(key, String(value));
    query.set("page", "1");
    startTransition(() => router.push(`/leads?${query.toString()}`, { scroll: false }));
  }

  return <div className="space-y-6" aria-busy={pending}>
    <PageHeader title="Leads" eyebrow={organization.name} description="Build relationships. Move every opportunity forward.">
      <LeadEditorDialog data={data} />
    </PageHeader>

    <section aria-label="Lead overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[
        { label: "Total leads", value: metrics.total, icon: UsersRound, note: "All permitted active leads", color: "text-primary bg-primary/10" },
        { label: "New leads", value: metrics.new, icon: Sparkles, note: "Ready for a first conversation", color: "text-blue-600 bg-blue-500/10 dark:text-blue-300" },
        { label: "Qualified leads", value: metrics.qualified, icon: CircleDot, note: "Opportunities with a clear fit", color: "text-violet-600 bg-violet-500/10 dark:text-violet-300" },
        { label: "Won leads", value: metrics.won, icon: CheckCheck, note: "Won and legacy converted leads", color: "text-emerald-700 bg-emerald-500/10 dark:text-emerald-300" },
      ].map(metric => <Card key={metric.label} className="gap-3 p-4 shadow-xs sm:p-5"><div className="flex items-center justify-between gap-2"><h2 className="text-xs font-medium text-muted-foreground">{metric.label}</h2><span className={cn("flex size-8 items-center justify-center rounded-lg", metric.color)}><metric.icon className="size-4" aria-hidden="true" /></span></div><p className="text-3xl font-semibold tracking-tight tabular-nums">{metric.value.toLocaleString("en-GB")}</p><p className="hidden text-[11px] leading-5 text-muted-foreground sm:block">{metric.note}</p></Card>)}
    </section>

    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <form key={JSON.stringify(filters)} action="/leads" method="get" onSubmit={applyFilters} aria-label="Search and filter leads" className="space-y-4 border-b p-4 sm:p-5">
        <input type="hidden" name="view" value={filters.view} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(200px,2fr)_1fr_1fr]">
          <div className="space-y-2"><Label htmlFor="lead-search" className="text-xs">Search leads</Label><div className="relative"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input id="lead-search" name="search" type="search" defaultValue={filters.search} maxLength={120} placeholder="Name, email or phone" className="h-10 pl-9" /></div></div>
          <div className="space-y-2"><Label htmlFor="lead-status-filter" className="text-xs">Status</Label><select id="lead-status-filter" name="status" defaultValue={filters.status} className={selectClassName}><option value="">All statuses</option>{leadStatusOptions.map(status => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-agent-filter" className="text-xs">Assigned agent</Label><select id="lead-agent-filter" name="assignedMembershipId" defaultValue={filters.assignedMembershipId} className={selectClassName}><option value="">All permitted agents</option>{assignees.map(member => <option key={member.id} value={member.id}>{member.userProfile?.displayName || member.email}{member.id === membership.id ? " (you)" : ""}</option>)}</select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="lead-source-filter" className="text-xs">Lead source</Label><select id="lead-source-filter" name="sourceId" defaultValue={filters.sourceId} className={selectClassName}><option value="">All sources</option>{sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-priority-filter" className="text-xs">Priority</Label><select id="lead-priority-filter" name="priority" defaultValue={filters.priority} className={selectClassName}><option value="">All priorities</option>{Object.entries(leadPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-created-from" className="text-xs">Created from (UTC)</Label><Input id="lead-created-from" type="date" name="createdFrom" defaultValue={filters.createdFrom} className="h-10" /></div>
          <div className="space-y-2"><Label htmlFor="lead-created-to" className="text-xs">Created through (UTC)</Label><Input id="lead-created-to" type="date" name="createdTo" defaultValue={filters.createdTo} className="h-10" /></div>
        </div>
        <details className="group rounded-lg border bg-muted/15 px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-muted-foreground"><SlidersHorizontal className="size-3.5" aria-hidden="true" />More options<span className="ml-auto text-[11px] group-open:hidden">Branch, follow-up and sorting</span></summary><div className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="lead-branch-filter" className="text-xs">Branch</Label><select id="lead-branch-filter" name="branchId" defaultValue={filters.branchId} className={selectClassName}><option value="">All branches</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-followup-filter" className="text-xs">Follow-up</Label><select id="lead-followup-filter" name="followUp" defaultValue={filters.followUp} className={selectClassName}><option value="ALL">All follow-ups</option><option value="OVERDUE">Overdue</option><option value="UPCOMING">Upcoming</option></select></div>
          <div className="space-y-2"><Label htmlFor="lead-sort" className="text-xs">Sort leads</Label><select id="lead-sort" name="sort" defaultValue={filters.sort} className={selectClassName}>{Object.entries(leadSortLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-page-size" className="text-xs">Leads per page</Label><select id="lead-page-size" name="pageSize" defaultValue={filters.pageSize} className={selectClassName}>{[10,25,50].map(size => <option key={size} value={size}>{size}</option>)}</select></div>
        </div></details>
        {filterError && <p role="alert" className="text-xs text-destructive">{filterError}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-muted-foreground">{data.canManageAssignments ? "Company leads within your active workspace." : "Only leads authorized by your membership are shown."} KPI cards show totals before filters.</p><div className="flex gap-2">{hasFilters && <Link href={`/leads?view=${filters.view}`} className={buttonVariants({variant:"ghost",size:"sm"})}>Clear filters</Link>}<Button type="submit" size="sm" disabled={pending}>{pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}Apply filters</Button></div></div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">{hasFilters ? "Filtered leads" : "Your leads"}<span className="ml-2 inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">{total.toLocaleString("en-GB")}</span></h2><p className="mt-1 text-[11px] text-muted-foreground">{total && leads.length ? `${(filters.page - 1) * filters.pageSize + 1}–${Math.min(filters.page * filters.pageSize,total)} of ${total.toLocaleString("en-GB")}` : "No results on this page"}{filters.view === "KANBAN" ? " · Board shows this page only" : ""}</p></div><div className="inline-flex gap-1 rounded-lg border bg-muted/30 p-1" role="group" aria-label="Lead view"><Button variant={filters.view === "LIST" ? "secondary" : "ghost"} size="sm" className="h-8" aria-pressed={filters.view === "LIST"} disabled={pending} onClick={() => navigate({view:"LIST"})}><List aria-hidden="true" />List</Button><Button variant={filters.view === "KANBAN" ? "secondary" : "ghost"} size="sm" className="h-8" aria-pressed={filters.view === "KANBAN"} disabled={pending} onClick={() => navigate({view:"KANBAN"})}><Columns3 aria-hidden="true" />Kanban</Button></div></div>

      {filters.view === "KANBAN" ? <LeadsKanban key={`${organization.id}:${JSON.stringify(filters)}`} data={data} /> : leads.length === 0 ? <EmptyState icon={UsersRound} title={hasFilters || filters.page > 1 ? "No leads match this view" : "Your next relationship starts here"} description={hasFilters || filters.page > 1 ? "Adjust your filters or return to the first page." : "Create a lead to capture an inquiry, assign an agent and plan the next conversation."} className="min-h-80">{hasFilters || filters.page > 1 ? <Link href="/leads" className={buttonVariants({variant:"outline"})}>Clear filters</Link> : <LeadEditorDialog data={data}>Create your first lead</LeadEditorDialog>}</EmptyState> : <>
        <div className="divide-y md:hidden">{leads.map(lead => <article key={lead.id} className="space-y-4 p-4"><LeadIdentity lead={lead} /><div className="flex flex-wrap items-center justify-between gap-2"><LeadStatusBadge status={lead.status} /><LeadPriority priority={lead.priority} /></div><div className="grid grid-cols-2 gap-3 text-xs"><div><p className="text-[11px] text-muted-foreground">Assigned agent</p><p className="mt-1 truncate">{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</p></div><div><p className="text-[11px] text-muted-foreground">Next follow-up</p><p className="mt-1">{lead.followUpAt ? formatLeadDate(lead.followUpAt) : "Not scheduled"}</p></div></div><Link href={`/leads/${lead.id}`} className="inline-flex items-center gap-2 text-xs font-medium text-primary">View lead<ArrowRight className="size-3.5" aria-hidden="true" /></Link></article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Authorized leads for {organization.name}</caption><thead className="border-b bg-muted/20 text-[11px] text-muted-foreground"><tr><th scope="col" className="min-w-60 px-5 py-3 font-medium"><button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => navigate({sort:filters.sort === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC",page:1})} aria-label="Sort by lead name"><span>Lead</span><ArrowDownUp className="size-3" aria-hidden="true" /></button></th><th scope="col" className="px-4 py-3 font-medium">Stage</th><th scope="col" className="px-4 py-3 font-medium">Priority</th><th scope="col" className="min-w-36 px-4 py-3 font-medium">Agent</th><th scope="col" className="px-4 py-3 font-medium">Source</th><th scope="col" className="min-w-40 px-4 py-3 font-medium">Budget</th><th scope="col" className="min-w-36 px-4 py-3 font-medium"><button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => navigate({sort:"FOLLOW_UP_ASC",page:1})}>Follow-up<ArrowDownUp className="size-3" aria-hidden="true" /></button></th><th scope="col" className="px-4 py-3 font-medium"><button className="inline-flex items-center gap-1.5 hover:text-foreground" onClick={() => navigate({sort:filters.sort === "CREATED_DESC" ? "CREATED_ASC" : "CREATED_DESC",page:1})}>Created<ArrowDownUp className="size-3" aria-hidden="true" /></button></th><th scope="col"><span className="sr-only">Open lead</span></th></tr></thead><tbody className="divide-y">{leads.map(lead => <tr key={lead.id} className="transition-colors hover:bg-muted/25"><th scope="row" className="max-w-80 px-5 py-4 font-normal"><LeadIdentity lead={lead} /></th><td className="px-4 py-4"><LeadStatusBadge status={lead.status} />{lead.pipelineStage && lead.pipelineStage.name !== leadStatusLabels[lead.status] && <p className="mt-1 text-[11px] text-muted-foreground">{lead.pipelineStage.name}</p>}</td><td className="px-4 py-4"><LeadPriority priority={lead.priority} /></td><td className="max-w-44 px-4 py-4 text-xs"><span className="block truncate">{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</span></td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{sources.find(source=>source.id === lead.sourceId)?.name || lead.source || "Not specified"}</td><td className="px-4 py-4 text-xs tabular-nums">{leadBudget(lead)}</td><td className="px-4 py-4 text-xs text-muted-foreground">{lead.followUpAt ? <time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt,true)}</time> : "Not scheduled"}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground"><time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt)}</time></td><td className="pr-4"><Link href={`/leads/${lead.id}`} aria-label={`Open ${lead.fullName}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"><ArrowRight className="size-4" aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
      </>}

      <nav aria-label="Lead list pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-5"><p className="text-[11px] text-muted-foreground">Page {filters.page} of {pageCount} · {filters.pageSize} leads per page</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={pending || filters.page <= 1} onClick={() => navigate({page:filters.page-1})}><ChevronLeft aria-hidden="true" />Previous</Button><span className="px-1 text-xs tabular-nums" aria-current="page">{filters.page}</span><Button variant="outline" size="sm" disabled={pending || !hasNext} onClick={() => navigate({page:filters.page+1})}>Next<ChevronRight aria-hidden="true" /></Button></div></nav>
    </Card>
    <p role="status" className="text-[11px] text-muted-foreground">{pending ? "Loading your lead view…" : "Dates are shown in Dubai time. Date range filters use UTC calendar days."}</p>
  </div>;
}
