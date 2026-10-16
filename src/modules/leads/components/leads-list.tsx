import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Plus, Search, SlidersHorizontal, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LeadListData } from "@/modules/leads/types";
import { cn } from "@/lib/utils";
import { formatLeadDate, LeadStatusBadge, leadStatusLabels, leadStatusOptions, selectClassName } from "./lead-ui";

function pageHref(filters: LeadListData["filters"], page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== "" && key !== "page") query.set(key, String(value));
  }
  query.set("page", String(page));
  return `/workspace/leads?${query.toString()}`;
}

export function LeadsList({ data }: { data: LeadListData }) {
  const { organization, membership, branches, assignees, filters, leads, hasNext } = data;
  const hasFilters = Boolean(filters.search || filters.status || filters.branchId || filters.assignedMembershipId || (filters.followUp && filters.followUp !== "ALL"));
  return <div className="space-y-6">
    <PageHeader title="Leads" eyebrow={organization.name} description="Every relationship starts with a conversation. Keep yours moving forward.">
      <Link href="/workspace/leads/new" className={cn(buttonVariants({ size: "lg" }), "h-10 gap-2 px-4")}><Plus aria-hidden="true" />Create lead</Link>
    </PageHeader>

    <Card className="gap-0 py-0 shadow-xs ring-border">
      <form action="/workspace/leads" method="get" className="space-y-4 border-b p-4 sm:p-5" aria-label="Search and filter leads">
        <div className="flex items-center gap-2 text-xs font-semibold"><SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />Search and filters</div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2"><Label htmlFor="lead-search" className="text-xs">Search leads</Label><div className="relative"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input id="lead-search" name="search" type="search" defaultValue={filters.search} maxLength={120} placeholder="Name, email or phone" className="h-10 pl-9" /></div></div>
          <div className="space-y-2 sm:w-44"><Label htmlFor="lead-status-filter" className="text-xs">Status</Label><select id="lead-status-filter" name="status" defaultValue={filters.status ?? ""} className={selectClassName}><option value="">All statuses</option>{leadStatusOptions.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></div>
          <div className="space-y-2 sm:w-44"><Label htmlFor="lead-followup-filter" className="text-xs">Follow-up</Label><select id="lead-followup-filter" name="followUp" defaultValue={filters.followUp ?? "ALL"} className={selectClassName}><option value="ALL">All follow-ups</option><option value="OVERDUE">Overdue</option><option value="UPCOMING">Upcoming</option></select></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <div className="space-y-2"><Label htmlFor="lead-branch-filter" className="text-xs">Branch</Label><select id="lead-branch-filter" name="branchId" defaultValue={filters.branchId ?? ""} className={selectClassName}><option value="">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-agent-filter" className="text-xs">Assigned to</Label><select id="lead-agent-filter" name="assignedMembershipId" defaultValue={filters.assignedMembershipId ?? ""} className={selectClassName}><option value="">All permitted leads</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.userProfile?.displayName || assignee.email}{assignee.id === membership.id ? " (you)" : ""}</option>)}</select></div>
          <div className="space-y-2"><Label htmlFor="lead-page-size" className="text-xs">Per page</Label><select id="lead-page-size" name="pageSize" defaultValue={filters.pageSize} className={selectClassName}>{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
          <div className="flex items-center gap-2"><button type="submit" className={cn(buttonVariants({ size: "lg" }), "h-10 flex-1 px-4")}>Apply filters</button>{hasFilters && <Link href="/workspace/leads" className={cn(buttonVariants({ variant: "ghost", size: "lg" }), "h-10")}>Reset</Link>}</div>
        </div>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-4 sm:px-5"><h2 className="text-sm font-semibold">{hasFilters ? "Search results" : "Your leads"}</h2><p className="text-xs text-muted-foreground">{leads.length} {leads.length === 1 ? "lead" : "leads"} on this page<span aria-hidden="true"> · </span>Page {filters.page}</p></div>

      {leads.length === 0 ? <EmptyState icon={UsersRound} title={hasFilters || filters.page > 1 ? "No leads match this view" : "Your next relationship starts here"} description={hasFilters || filters.page > 1 ? "Try a different search or filter, or return to the first page." : "Create your first lead to capture contact details, assign an agent and plan a follow-up."} className="min-h-80">
        {hasFilters || filters.page > 1 ? <Link href="/workspace/leads" className={buttonVariants({ variant: "outline", size: "lg" })}>Clear filters</Link> : <Link href="/workspace/leads/new" className={buttonVariants({ size: "lg" })}><Plus aria-hidden="true" />Create lead</Link>}
      </EmptyState> : <>
        <div className="divide-y md:hidden">{leads.map((lead) => <article key={lead.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><Link href={`/workspace/leads/${lead.id}`} className="min-w-0 break-words font-semibold text-primary hover:underline">{lead.fullName}</Link><LeadStatusBadge status={lead.status} /></div><p className="truncate text-xs text-muted-foreground">{lead.email || lead.phone || "No contact details"}</p><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</span><span className="text-muted-foreground">{lead.followUpAt ? `Follow-up ${formatLeadDate(lead.followUpAt)}` : "No follow-up"}</span></div></article>)}</div>
        <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><caption className="sr-only">Permitted leads for {organization.name}. Open a lead to see its details.</caption><thead className="border-b bg-muted/30 text-xs text-muted-foreground"><tr><th scope="col" className="px-5 py-3 font-medium">Lead</th><th scope="col" className="px-4 py-3 font-medium">Status</th><th scope="col" className="px-4 py-3 font-medium">Assigned to</th><th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Branch / source</th><th scope="col" className="px-4 py-3 font-medium">Follow-up</th><th scope="col" className="px-4 py-3"><span className="sr-only">Open lead</span></th></tr></thead><tbody className="divide-y">{leads.map((lead) => <tr key={lead.id} className="transition-colors hover:bg-muted/30"><th scope="row" className="max-w-72 px-5 py-4 font-normal"><Link href={`/workspace/leads/${lead.id}`} className="break-words font-semibold text-primary underline-offset-4 hover:underline">{lead.fullName}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{lead.email || lead.phone || "No contact details"}</p></th><td className="px-4 py-4"><LeadStatusBadge status={lead.status} /></td><td className="max-w-48 px-4 py-4"><p className="truncate text-xs">{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</p></td><td className="hidden max-w-44 px-4 py-4 xl:table-cell"><p className="truncate text-xs">{lead.branch?.name || "No branch"}</p><p className="mt-1 truncate text-xs text-muted-foreground">{lead.source || "No source"}</p></td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{lead.followUpAt ? <time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt, true)}</time> : "Not scheduled"}</td><td className="px-4 py-4"><Link href={`/workspace/leads/${lead.id}`} aria-label={`Open ${lead.fullName}`} className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary"><ArrowRight className="size-4" aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
      </>}

      <nav aria-label="Lead list pagination" className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4 sm:px-5"><p className="text-xs text-muted-foreground">Only leads permitted by your membership are shown.</p><div className="flex items-center gap-2">{filters.page > 1 ? <Link href={pageHref(filters, filters.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Previous</Link> : <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-40")}><ChevronLeft aria-hidden="true" />Previous</span>}<span className="px-1 text-xs text-muted-foreground" aria-current="page">{filters.page}</span>{hasNext ? <Link href={pageHref(filters, filters.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Next<ChevronRight aria-hidden="true" /></Link> : <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-40")}>Next<ChevronRight aria-hidden="true" /></span>}</div></nav>
    </Card>
    <p className="text-xs leading-5 text-muted-foreground">Follow-up dates are shown in Dubai time (UTC+4).</p>
  </div>;
}
