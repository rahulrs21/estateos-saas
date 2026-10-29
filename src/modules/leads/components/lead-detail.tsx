import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowLeft, Building2, CalendarClock, ChevronLeft, ChevronRight, Clock3, Flag, Mail, MapPin, MessageSquareText, Phone, Sparkles, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadActivity, LeadDetailData } from "@/modules/leads/types";
import { LeadAssignment, LeadFollowUp, LeadFollowUpCompletion, LeadNoteForm, LeadStatusPipeline } from "./lead-actions";
import { LeadEditorDialog } from "./lead-form";
import { formatLeadDate, LeadStatusBadge, leadStatusLabels } from "./lead-ui";
import { AiContentLink } from "@/modules/ai/content/components/ai-content-link";

const activityLabels: Record<string, string> = {
  LEAD_CREATED: "Lead created", LEAD_UPDATED: "Lead details updated", LEAD_ARCHIVED: "Lead archived",
  LEAD_NOTE_ADDED: "Note added", LEAD_STATUS_CHANGED: "Pipeline changed", LEAD_ASSIGNED: "Assignment changed",
  FOLLOW_UP_SCHEDULED: "Follow-up scheduled", FOLLOW_UP_COMPLETED: "Follow-up completed",
  LEAD_PROPERTY_INTEREST_CHANGED: "Property shortlist updated", LEAD_PRIMARY_INTEREST_CHANGED: "Interested inventory updated",
  LEAD_PROPERTY_VIEWING_SCHEDULED: "Property viewing scheduled", LEAD_PROPERTY_VIEWING_UPDATED: "Property viewing updated",
};

function activityDescription(activity: LeadActivity, data: LeadDetailData) {
  const metadata = typeof activity.metadata === "object" && activity.metadata !== null ? activity.metadata as Record<string, unknown> : {};
  if (activity.kind === "LEAD_STATUS_CHANGED" && typeof metadata.status === "string" && metadata.status in leadStatusLabels) return `Moved to ${leadStatusLabels[metadata.status as keyof typeof leadStatusLabels].toLowerCase()}.`;
  if (activity.kind === "LEAD_ASSIGNED") {
    if (metadata.assignedMembershipId === null) return "The lead is now unassigned.";
    const member = data.assignees.find(entry => entry.id === metadata.assignedMembershipId);
    if (member) return `Assigned to ${member.userProfile?.displayName || member.email}.`;
  }
  if (activity.kind === "FOLLOW_UP_SCHEDULED" && typeof metadata.followUpAt === "string") return `Scheduled for ${formatLeadDate(metadata.followUpAt, true)} (Dubai time).`;
  return null;
}

function DetailValue({ label, children }: { label: string; children?: ReactNode }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 break-words text-sm font-medium">{children || <span className="font-normal text-muted-foreground">Not provided</span>}</dd></div>;
}

export function LeadDetail({ data, propertySection, salesSection }: { data: LeadDetailData; propertySection?: ReactNode; salesSection?: ReactNode }) {
  const { lead, organization, membership, activities, activityPage, hasMoreActivities, followUps, followUpPage, followUpTotal, hasMoreFollowUps } = data;
  const currency = lead.currency ?? "AED";
  const amount = (value?: number | null) => value == null ? null : `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  const historyHref = (activity: number, followUp: number, anchor: string) => `/leads/${lead.id}?activityPage=${activity}&followUpPage=${followUp}#${anchor}`;
  const sourceName = data.sources.find(source => source.id === lead.sourceId)?.name || lead.source;
  return <div className="space-y-6 break-words">
    <Link href="/leads" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to leads</Link>
    <div className="[&_h1]:break-words [&_h1]:[overflow-wrap:anywhere]"><PageHeader title={lead.fullName} eyebrow={organization.name} description="Customer information, conversations and the next step in one place."><AiContentLink label="Generate WhatsApp Follow-up" type="WHATSAPP_MESSAGE" purpose="ENQUIRY_FOLLOW_UP" record={{kind: "leadId", id: lead.id}} /><AiContentLink label="Generate Email Draft" type="EMAIL" purpose="FOLLOW_UP" record={{kind: "leadId", id: lead.id}} />{!lead.archivedAt && <LeadEditorDialog data={data} />}</PageHeader></div>
    {lead.archivedAt && <div role="status" className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Archived on {formatLeadDate(lead.archivedAt, true)}. This record and its history are available for reference.</div>}

    <div className="grid gap-4 sm:grid-cols-3">
      <Card className="gap-2 py-4 shadow-xs ring-border"><CardContent className="px-5"><p className="text-xs text-muted-foreground">Current stage</p><div className="mt-3"><LeadStatusBadge status={lead.status} /></div>{lead.pipelineStage?.name && lead.pipelineStage.name !== leadStatusLabels[lead.status] && <p className="mt-2 text-xs text-muted-foreground">{lead.pipelineStage.name}</p>}</CardContent></Card>
      <Card className="gap-2 py-4 shadow-xs ring-border"><CardContent className="px-5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Flag className="size-3.5" aria-hidden="true" />Priority</p><p className="mt-3 text-base font-semibold capitalize">{(lead.priority ?? "NORMAL").toLowerCase()}</p></CardContent></Card>
      <Card className="gap-2 py-4 shadow-xs ring-border"><CardContent className="px-5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><Sparkles className="size-3.5" aria-hidden="true" />Lead score</p><a href="#ai-sales" className="mt-3 inline-flex text-sm font-medium text-primary hover:underline">View AI sales assistant</a><p className="mt-1 text-[11px] text-muted-foreground">Rule-based score, next actions and matches.</p></CardContent></Card>
    </div>

    <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Lead pipeline</CardTitle><CardDescription>Move this opportunity to reflect your latest conversation.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><LeadStatusPipeline lead={lead} pipelines={data.pipelines} /></CardContent></Card>

    {salesSection}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-5">
        <Card className="gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Customer information</CardTitle><CardDescription>Contact information shared with your agency.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><dl className="grid gap-6 sm:grid-cols-2">
          <DetailValue label="Full name">{lead.fullName}</DetailValue>
          <DetailValue label="Email address">{lead.email && <a href={`mailto:${encodeURIComponent(lead.email)}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"><Mail className="size-3.5 shrink-0" aria-hidden="true" />{lead.email}</a>}</DetailValue>
          <DetailValue label="Phone number">{lead.phone && <a href={`tel:${lead.phone.replace(/[^+0-9]/g, "")}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"><Phone className="size-3.5" aria-hidden="true" />{lead.phone}</a>}</DetailValue>
          <DetailValue label="Alternate phone">{lead.contact?.alternatePhone && <a href={`tel:${lead.contact.alternatePhone.replace(/[^+0-9]/g, "")}`} className="text-primary hover:underline">{lead.contact.alternatePhone}</a>}</DetailValue>
          <DetailValue label="Nationality">{lead.contact?.nationality}</DetailValue><DetailValue label="Preferred language">{lead.contact?.preferredLanguage}</DetailValue>
          <DetailValue label="Lead source">{sourceName}</DetailValue><DetailValue label="Branch">{lead.branch?.name}</DetailValue>
        </dl>{lead.contact?.notes && <div className="mt-6 border-t pt-5"><h3 className="text-xs font-medium">Contact notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{lead.contact.notes}</p></div>}</CardContent></Card>

        <Card id="lead-requirements" className="scroll-mt-24 gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Property requirements</CardTitle></div><CardDescription>Preferences for this opportunity.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><dl className="grid gap-6 sm:grid-cols-2">
          <DetailValue label="Project or property interest">{lead.propertyInterest}</DetailValue><DetailValue label="Preferred location">{lead.preferredLocation && <span className="inline-flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />{lead.preferredLocation}</span>}</DetailValue>
          <DetailValue label="Property type">{lead.propertyType}</DetailValue><DetailValue label="Transaction type">{lead.transactionType && <span className="capitalize">{lead.transactionType.toLowerCase()}</span>}</DetailValue>
          <DetailValue label="Minimum budget">{amount(lead.budgetMin)}</DetailValue><DetailValue label="Maximum budget">{amount(lead.budgetMax)}</DetailValue><DetailValue label="Bedrooms">{lead.bedroomPreference}</DetailValue>
        </dl></CardContent></Card>

        {propertySection}

        <Card id="timeline" className="scroll-mt-24 gap-0 py-5 shadow-xs ring-border"><CardHeader className="border-b px-5 pb-5 sm:px-6"><div className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Notes and activity</CardTitle></div><CardDescription>Conversations and changes, most recent first. Times are in Dubai.</CardDescription></CardHeader><CardContent className="border-b px-5 py-5 sm:px-6"><LeadNoteForm lead={lead} /></CardContent>
          <CardContent className="px-5 pt-6 sm:px-6">{activities.length === 0 ? <EmptyState icon={MessageSquareText} title="No activity on this page" description="Notes and lead updates will appear here as your team works on this opportunity." className="py-8" /> : <ol aria-label="Lead activity timeline">{activities.map((entry, index) => {
            const description = activityDescription(entry, data);
            return <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">{index !== activities.length - 1 && <span className="absolute top-8 bottom-0 left-3.5 w-px bg-border" aria-hidden="true" />}<span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground">{entry.kind === "LEAD_NOTE_ADDED" ? <MessageSquareText className="size-3" aria-hidden="true" /> : entry.kind.startsWith("FOLLOW_UP") ? <CalendarClock className="size-3" aria-hidden="true" /> : <Activity className="size-3" aria-hidden="true" />}</span><div className="min-w-0 flex-1 pt-0.5"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h3 className="text-xs font-semibold">{activityLabels[entry.kind] || "Lead activity"}</h3><time dateTime={entry.createdAt} className="text-[11px] text-muted-foreground">{formatLeadDate(entry.createdAt, true)}</time></div><p className="mt-1 text-[11px] text-muted-foreground">{entry.actor?.displayName || "Company member"}</p>{description && <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>}{entry.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border bg-muted/25 px-3 py-2.5 text-sm leading-6">{entry.note}</p>}</div></li>;
          })}</ol>}</CardContent>
          {(activityPage > 1 || hasMoreActivities) && <nav aria-label="Activity pagination" className="mt-5 flex items-center justify-between gap-3 border-t px-5 pt-4 sm:px-6"><span className="text-xs text-muted-foreground">Activity page {activityPage}</span><div className="flex gap-2">{activityPage > 1 && <Link href={historyHref(activityPage - 1, followUpPage, "timeline")} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Newer</Link>}{hasMoreActivities && <Link href={historyHref(activityPage + 1, followUpPage, "timeline")} className={buttonVariants({ variant: "outline", size: "sm" })}>Older<ChevronRight aria-hidden="true" /></Link>}</div></nav>}
        </Card>

        <Card id="follow-up-history" className="scroll-mt-24 gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex items-center justify-between gap-3"><CardTitle role="heading" aria-level={2}>Follow-up history</CardTitle><Badge variant="outline">{followUpTotal}</Badge></div><CardDescription>Scheduled, completed and cancelled work for this lead.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6">{followUps.length ? <ol className="space-y-3" aria-label="Follow-up history">{followUps.map(followUp => <li key={followUp.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-medium">{followUp.title}</h3><p className="mt-1 text-xs text-muted-foreground">Due <time dateTime={followUp.dueAt}>{formatLeadDate(followUp.dueAt, true)}</time></p>{followUp.assignedUser && <p className="mt-1 text-xs text-muted-foreground">Assigned to {followUp.assignedUser.userProfile?.displayName || followUp.assignedUser.email}</p>}</div><Badge variant="outline" className="capitalize">{followUp.status.toLowerCase()}</Badge></div>{followUp.completedAt && <p className="mt-2 text-xs text-muted-foreground">Completed <time dateTime={followUp.completedAt}>{formatLeadDate(followUp.completedAt, true)}</time></p>}<div className="mt-3"><LeadFollowUpCompletion lead={lead} followUp={followUp} /></div></li>)}</ol> : <EmptyState icon={CalendarClock} title="No follow-ups on this page" description="Schedule a next step to start a history of your work on this lead." className="py-8" />}</CardContent>{(followUpPage > 1 || hasMoreFollowUps) && <nav aria-label="Follow-up pagination" className="flex items-center justify-between gap-3 border-t px-5 pt-4 sm:px-6"><span className="text-xs text-muted-foreground">Page {followUpPage} of {Math.max(1, Math.ceil(followUpTotal / 10))}</span><div className="flex gap-2">{followUpPage > 1 && <Link href={historyHref(activityPage, followUpPage - 1, "follow-up-history")} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Previous</Link>}{hasMoreFollowUps && <Link href={historyHref(activityPage, followUpPage + 1, "follow-up-history")} className={buttonVariants({ variant: "outline", size: "sm" })}>Next<ChevronRight aria-hidden="true" /></Link>}</div></nav>}</Card>
      </div>

      <aside className="space-y-5" aria-label="Lead responsibility and follow-up">
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Responsibility</CardTitle></div></CardHeader><CardContent className="px-5"><LeadAssignment data={data} /></CardContent></Card>
        <Card className="gap-4 py-5 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Next follow-up</CardTitle></div></CardHeader><CardContent className="px-5"><LeadFollowUp lead={lead} /><p className="mt-4 text-[11px] leading-5 text-muted-foreground">Follow-ups are saved to this company workspace. Email, calendar and push reminders are not connected.</p></CardContent></Card>
        <section aria-label="Lead record information" className="space-y-3 px-1 text-xs text-muted-foreground"><p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>Created <time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt, true)}</time><br /><span className="mt-1 inline-block">Updated <time dateTime={lead.updatedAt}>{formatLeadDate(lead.updatedAt, true)}</time></span></span></p>{lead.leadNumber && <p className="break-all leading-5">Lead reference: {lead.leadNumber}</p>}<p className="leading-5">All times are in Dubai (UTC+4). {["AGENT", "MANAGER"].includes(membership.role) ? "Your access is limited to leads assigned to you." : "Access follows your active company membership."}</p></section>
      </aside>
    </div>
  </div>;
}
