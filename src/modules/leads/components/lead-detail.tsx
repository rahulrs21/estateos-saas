import Link from "next/link";
import { Activity, ArrowLeft, Building2, CalendarClock, ChevronLeft, ChevronRight, Clock3, Mail, MapPin, MessageSquareText, Pencil, Phone, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadActivity, LeadDetailData } from "@/modules/leads/types";
import { cn } from "@/lib/utils";
import { LeadAssignment, LeadFollowUp, LeadNoteForm, LeadStatusPipeline } from "./lead-actions";
import { formatLeadDate, LeadStatusBadge, leadStatusLabels } from "./lead-ui";

const activityLabels: Record<string, string> = {
  LEAD_CREATED: "Lead created", LEAD_UPDATED: "Lead details updated",
  LEAD_NOTE_ADDED: "Note added", LEAD_STATUS_CHANGED: "Status changed", LEAD_ASSIGNED: "Assignment changed",
  FOLLOW_UP_SCHEDULED: "Follow-up scheduled", FOLLOW_UP_COMPLETED: "Follow-up completed",
};

function activityDescription(activity: LeadActivity, data: LeadDetailData) {
  const metadata = typeof activity.metadata === "object" && activity.metadata !== null ? activity.metadata as Record<string, unknown> : {};
  if (activity.kind === "LEAD_STATUS_CHANGED" && typeof metadata.status === "string" && metadata.status in leadStatusLabels) return `Moved to ${leadStatusLabels[metadata.status as keyof typeof leadStatusLabels].toLowerCase()}.`;
  if (activity.kind === "LEAD_ASSIGNED") {
    if (metadata.assignedMembershipId === null) return "The lead is now unassigned.";
    const member = data.assignees.find((entry) => entry.id === metadata.assignedMembershipId);
    if (member) return `Assigned to ${member.userProfile?.displayName || member.email}.`;
  }
  if (activity.kind === "FOLLOW_UP_SCHEDULED" && typeof metadata.followUpAt === "string") return `Scheduled for ${formatLeadDate(metadata.followUpAt, true)} (Dubai time).`;
  return null;
}

export function LeadDetail({ data }: { data: LeadDetailData }) {
  const { lead, organization, membership, activities, activityPage, hasMoreActivities } = data;
  return <div className="space-y-6 break-words">
    <Link href="/workspace/leads" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to leads</Link>
    <div className="[&_h1]:break-words [&_h1]:[overflow-wrap:anywhere]"><PageHeader title={lead.fullName} eyebrow={organization.name} description="Contact details, conversations and the next step in one place."><Link href={`/workspace/leads/${lead.id}/edit`} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 bg-card px-4")}><Pencil aria-hidden="true" />Edit lead</Link></PageHeader></div>

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle role="heading" aria-level={2}>Lead pipeline</CardTitle><LeadStatusBadge status={lead.status} /></div><CardDescription>Choose a status to reflect your latest conversation.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><LeadStatusPipeline lead={lead} /></CardContent></Card>

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Card className="gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Contact information</CardTitle><CardDescription>Keep every conversation personal.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><dl className="grid gap-6 sm:grid-cols-2">
          <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="size-3.5" aria-hidden="true" />Email address</dt><dd className="mt-2 break-words text-sm">{lead.email ? <a href={`mailto:${encodeURIComponent(lead.email)}`} className="text-primary underline-offset-4 hover:underline">{lead.email}</a> : <span className="text-muted-foreground">Not provided</span>}</dd></div>
          <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Phone className="size-3.5" aria-hidden="true" />Phone number</dt><dd className="mt-2 text-sm">{lead.phone ? <a href={`tel:${lead.phone.replace(/[^+0-9]/g, "")}`} className="text-primary underline-offset-4 hover:underline">{lead.phone}</a> : <span className="text-muted-foreground">Not provided</span>}</dd></div>
          <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="size-3.5" aria-hidden="true" />Lead source</dt><dd className="mt-2 break-words text-sm">{lead.source || <span className="text-muted-foreground">Not provided</span>}</dd></div>
          <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><MapPin className="size-3.5" aria-hidden="true" />Branch</dt><dd className="mt-2 break-words text-sm">{lead.branch?.name || <span className="text-muted-foreground">No branch</span>}</dd></div>
        </dl></CardContent></Card>

        <Card id="timeline" className="scroll-mt-24 gap-0 py-5 shadow-xs ring-border"><CardHeader className="border-b px-5 pb-5 sm:px-6"><div className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Notes and activity</CardTitle></div><CardDescription>Conversations and changes, most recent first.</CardDescription></CardHeader><CardContent className="border-b px-5 py-5 sm:px-6"><LeadNoteForm lead={lead} /></CardContent>
          <CardContent className="px-5 pt-6 sm:px-6">{activities.length === 0 ? <EmptyState icon={MessageSquareText} title="No activity on this page" description="Notes and lead updates will appear here as your team works on this opportunity." className="py-8" /> : <ol aria-label="Lead activity timeline" className="space-y-0">{activities.map((entry, index) => {
            const description = activityDescription(entry, data);
            return <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">{index !== activities.length - 1 && <span className="absolute top-8 bottom-0 left-3.5 w-px bg-border" aria-hidden="true" />}<span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">{entry.kind === "LEAD_NOTE_ADDED" ? <MessageSquareText className="size-3" aria-hidden="true" /> : entry.kind.startsWith("FOLLOW_UP") ? <CalendarClock className="size-3" aria-hidden="true" /> : <Activity className="size-3" aria-hidden="true" />}</span><div className="min-w-0 flex-1 pt-0.5"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h3 className="text-xs font-semibold">{activityLabels[entry.kind] || "Lead activity"}</h3><time dateTime={entry.createdAt} className="text-[11px] text-muted-foreground">{formatLeadDate(entry.createdAt, true)}</time></div><p className="mt-1 text-[11px] text-muted-foreground">{entry.actor?.displayName || "Organization member"}</p>{description && <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>}{entry.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border bg-muted/25 px-3 py-2.5 text-sm leading-6">{entry.note}</p>}</div></li>;
          })}</ol>}</CardContent>
          {(activityPage > 1 || hasMoreActivities) && <nav aria-label="Activity pagination" className="mt-5 flex items-center justify-between gap-3 border-t px-5 pt-4 sm:px-6"><span className="text-xs text-muted-foreground">Activity page {activityPage}</span><div className="flex gap-2">{activityPage > 1 && <Link href={`/workspace/leads/${lead.id}?activityPage=${activityPage - 1}#timeline`} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Newer</Link>}{hasMoreActivities && <Link href={`/workspace/leads/${lead.id}?activityPage=${activityPage + 1}#timeline`} className={buttonVariants({ variant: "outline", size: "sm" })}>Older<ChevronRight aria-hidden="true" /></Link>}</div></nav>}
        </Card>
      </div>

      <aside className="space-y-5" aria-label="Lead responsibility and follow-up">
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Responsibility</CardTitle></div></CardHeader><CardContent className="px-5"><LeadAssignment data={data} /></CardContent></Card>
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Next follow-up</CardTitle></div></CardHeader><CardContent className="px-5"><LeadFollowUp lead={lead} /><p className="mt-4 text-[11px] leading-5 text-muted-foreground">Scheduling records the next step. Email, calendar and push reminders are not connected.</p></CardContent></Card>
        <section aria-label="Lead record information" className="space-y-3 px-1 text-xs text-muted-foreground"><p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>Created <time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt, true)}</time><br /><span className="mt-1 inline-block">Updated <time dateTime={lead.updatedAt}>{formatLeadDate(lead.updatedAt, true)}</time></span></span></p><p className="leading-5">All times are in Dubai (UTC+4). {membership.role === "AGENT" ? "Your access is limited to leads assigned to you." : "Access follows your active organization membership."}</p></section>
      </aside>
    </div>
  </div>;
}
