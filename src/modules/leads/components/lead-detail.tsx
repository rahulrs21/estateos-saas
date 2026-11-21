import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowLeft, BedDouble, Building2, CalendarClock, ChevronLeft, ChevronRight, Clock3, Flag, Globe, Home, Languages, Mail, MapPin, Megaphone, MessageSquareText, Phone, Sparkles, UserRound, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadActivity, LeadDetailData } from "@/modules/leads/types";
import { LeadAssignment, LeadFollowUp, LeadFollowUpCompletion, LeadNoteForm, LeadStatusPipeline } from "./lead-actions";
import { LeadEditorDialog } from "./lead-form";
import { formatLeadDate, LeadAvatar, LeadStatusBadge, leadStatusLabels } from "./lead-ui";
import { enquiryFields, leadBudget, leadPriorityLabels } from "../presentation";
import { cn } from "@/lib/utils";
import { AiContentLink } from "@/modules/ai/content/components/ai-content-link";
import { CALL_DIRECTION_LABELS, CALL_OUTCOME_LABELS, CALL_STATUS_LABELS, type CallDirection, type CallOutcome, type CallStatus } from "@/modules/communications/model";

const activityLabels: Record<string, string> = {
  WEBSITE_LEAD_CAPTURED: "Website enquiry received",
  LEAD_CREATED: "Lead created", LEAD_UPDATED: "Lead details updated", LEAD_ARCHIVED: "Lead archived",
  LEAD_NOTE_ADDED: "Note added", LEAD_STATUS_CHANGED: "Pipeline changed", LEAD_ASSIGNED: "Assignment changed",
  FOLLOW_UP_SCHEDULED: "Follow-up scheduled", FOLLOW_UP_COMPLETED: "Follow-up completed",
  LEAD_PROPERTY_INTEREST_CHANGED: "Property shortlist updated", LEAD_PRIMARY_INTEREST_CHANGED: "Interested inventory updated",
  LEAD_PROPERTY_VIEWING_SCHEDULED: "Property viewing scheduled", LEAD_PROPERTY_VIEWING_UPDATED: "Property viewing updated",
  CALL_LOGGED: "Call logged", CALL_UPDATED: "Call updated",
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
  if (activity.kind === "CALL_LOGGED" && typeof metadata.callStatus === "string") {
    const direction = CALL_DIRECTION_LABELS[metadata.direction as CallDirection] ?? "Call";
    const outcome = typeof metadata.outcome === "string" ? CALL_OUTCOME_LABELS[metadata.outcome as CallOutcome] : null;
    return [`${direction} call`, CALL_STATUS_LABELS[metadata.callStatus as CallStatus]?.toLowerCase(), outcome?.toLowerCase()].filter(Boolean).join(", ") + ". Details are in Calls.";
  }
  if (activity.kind === "CALL_UPDATED" && typeof metadata.outcome === "string") return `Outcome recorded: ${CALL_OUTCOME_LABELS[metadata.outcome as CallOutcome]?.toLowerCase() ?? "updated"}.`;
  return null;
}

function DetailValue({ label, icon, children }: { label: string; icon?: ReactNode; children?: ReactNode }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5">{icon}{label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{children || <span className="font-normal text-muted-foreground">Not provided</span>}</dd></div>;
}

/** One fact in the header strip. */
function HeaderFact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div className="flex min-w-0 items-start gap-2 px-4 py-2.5"><span className="mt-0.5 text-muted-foreground [&_svg]:size-3.5" aria-hidden="true">{icon}</span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><div className="mt-0.5 text-sm font-medium [overflow-wrap:anywhere] lg:truncate">{children}</div></div></div>;
}

const PRIORITY_TONE = {
  LOW: "border-border bg-muted text-muted-foreground", NORMAL: "border-primary/20 bg-primary/5 text-primary",
  HIGH: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300", URGENT: "border-destructive/30 bg-destructive/10 text-destructive",
} as const;

function timelineTone(kind: string) {
  if (kind === "LEAD_NOTE_ADDED") return { icon: <MessageSquareText className="size-3" aria-hidden="true" />, tone: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300" };
  if (kind.startsWith("FOLLOW_UP")) return { icon: <CalendarClock className="size-3" aria-hidden="true" />, tone: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300" };
  if (kind === "WEBSITE_LEAD_CAPTURED") return { icon: <Globe className="size-3" aria-hidden="true" />, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
  if (kind.startsWith("CALL")) return { icon: <Phone className="size-3" aria-hidden="true" />, tone: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300" };
  if (kind === "LEAD_STATUS_CHANGED") return { icon: <Flag className="size-3" aria-hidden="true" />, tone: "border-primary/30 bg-primary/10 text-primary" };
  return { icon: <Activity className="size-3" aria-hidden="true" />, tone: "bg-background text-muted-foreground" };
}

export function LeadDetail({ data, propertySection, salesSection, callSection }: { data: LeadDetailData; propertySection?: ReactNode; salesSection?: ReactNode; callSection?: ReactNode }) {
  const { lead, organization, membership, activities, activityPage, hasMoreActivities, followUps, followUpPage, followUpTotal, hasMoreFollowUps } = data;
  const currency = lead.currency ?? "AED";
  const amount = (value?: number | null) => value == null ? null : `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)} ${currency}`;
  const historyHref = (activity: number, followUp: number, anchor: string) => `/leads/${lead.id}?activityPage=${activity}&followUpPage=${followUp}#${anchor}`;
  const sourceName = data.sources.find(source => source.id === lead.sourceId)?.name || lead.source;
  const agent = lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email;
  const priority = lead.priority ?? "NORMAL";
  const phoneHref = lead.phone ? `tel:${lead.phone.replace(/[^+0-9]/g, "")}` : null;
  const sections = [
    { href: "#overview", label: "Overview" },
    data.enquiry && { href: "#enquiry", label: "Enquiry" },
    salesSection && { href: "#ai-sales", label: "AI sales" },
    callSection && { href: "#calls", label: "Calls" },
    { href: "#lead-requirements", label: "Requirements" },
    propertySection && { href: "#properties", label: "Properties" },
    { href: "#timeline", label: "Activity" },
    { href: "#follow-up-history", label: `Follow-ups${followUpTotal ? ` · ${followUpTotal}` : ""}` },
  ].filter((section): section is { href: string; label: string } => Boolean(section));

  return <div className="space-y-4 break-words">
    <Link href="/leads" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to leads</Link>

    {/* Profile header: who, where they are in the pipeline, and the quickest ways to reach them. */}
    <Card className="gap-0 overflow-hidden py-0 shadow-xs ring-border">
      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <LeadAvatar name={lead.fullName} className="size-12 text-base" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{organization.name}</p>
              <h1 className="text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:text-2xl">{lead.fullName}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <LeadStatusBadge status={lead.status} />
                {lead.pipelineStage?.name && lead.pipelineStage.name !== leadStatusLabels[lead.status] && <span className="text-xs text-muted-foreground">{lead.pipelineStage.name}</span>}
                <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium", PRIORITY_TONE[priority])}><Flag className="size-3" aria-hidden="true" />{leadPriorityLabels[priority]} priority</span>
                {sourceName && <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-0.5 text-[11px] text-muted-foreground"><Megaphone className="size-3" aria-hidden="true" />{sourceName}</span>}
                {lead.leadNumber && <span className="text-[11px] text-muted-foreground">#{lead.leadNumber}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {phoneHref && <a href={phoneHref} className={buttonVariants({ variant: "outline" })}><Phone aria-hidden="true" />Call</a>}
            {lead.email && <a href={`mailto:${encodeURIComponent(lead.email)}`} className={buttonVariants({ variant: "outline" })}><Mail aria-hidden="true" />Email</a>}
            {!lead.archivedAt && <LeadEditorDialog data={data} />}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <AiContentLink size="sm" label="Generate WhatsApp Follow-up" type="WHATSAPP_MESSAGE" purpose="ENQUIRY_FOLLOW_UP" record={{kind: "leadId", id: lead.id}} />
          <AiContentLink size="sm" label="Generate Email Draft" type="EMAIL" purpose="FOLLOW_UP" record={{kind: "leadId", id: lead.id}} />
          <a href="#ai-sales" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"><Sparkles className="size-3.5" aria-hidden="true" />Lead score and next actions</a>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y border-t lg:grid-cols-5 lg:divide-y-0 [&>*:nth-child(2n+1)]:border-l-0 lg:[&>*:nth-child(2n+1)]:border-l">
        <HeaderFact icon={<Wallet />} label="Budget">{leadBudget(lead)}</HeaderFact>
        <HeaderFact icon={<MapPin />} label="Location">{lead.preferredLocation || <span className="font-normal text-muted-foreground">Not provided</span>}</HeaderFact>
        <HeaderFact icon={<UserRound />} label="Agent">{agent || <span className="font-normal text-muted-foreground">Unassigned</span>}</HeaderFact>
        <HeaderFact icon={<CalendarClock />} label="Next follow-up">{lead.followUpAt ? <time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt, true)}</time> : <span className="font-normal text-muted-foreground">Not scheduled</span>}</HeaderFact>
        <HeaderFact icon={<Clock3 />} label="Created"><time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt)}</time></HeaderFact>
      </div>
    </Card>
    {lead.archivedAt && <div role="status" className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">Archived on {formatLeadDate(lead.archivedAt, true)}. This record and its history are available for reference.</div>}

    <nav aria-label="Lead sections" className="sticky top-0 z-20 -mx-1 overflow-x-auto [scrollbar-width:none] bg-background/85 px-1 py-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <ul className="flex w-max gap-0.5 rounded-lg border bg-card p-0.5">{sections.map(section => <li key={section.href}><a href={section.href} className="block rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{section.label}</a></li>)}</ul>
    </nav>

    <Card className="gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Lead pipeline</CardTitle><CardDescription>Move this opportunity to reflect your latest conversation.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><LeadStatusPipeline lead={lead} pipelines={data.pipelines} /></CardContent></Card>

    {salesSection}

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <Card id="overview" className="scroll-mt-24 gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Customer information</CardTitle></div><CardDescription>Contact information shared with your agency.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><dl className="grid gap-6 sm:grid-cols-2">
          <DetailValue label="Full name" icon={<UserRound />}>{lead.fullName}</DetailValue>
          <DetailValue label="Email address" icon={<Mail />}>{lead.email && <a href={`mailto:${encodeURIComponent(lead.email)}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"><Mail className="size-3.5 shrink-0" aria-hidden="true" />{lead.email}</a>}</DetailValue>
          <DetailValue label="Phone number" icon={<Phone />}>{lead.phone && <a href={`tel:${lead.phone.replace(/[^+0-9]/g, "")}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline"><Phone className="size-3.5" aria-hidden="true" />{lead.phone}</a>}</DetailValue>
          <DetailValue label="Alternate phone" icon={<Phone />}>{lead.contact?.alternatePhone && <a href={`tel:${lead.contact.alternatePhone.replace(/[^+0-9]/g, "")}`} className="text-primary hover:underline">{lead.contact.alternatePhone}</a>}</DetailValue>
          <DetailValue label="Nationality" icon={<Globe />}>{lead.contact?.nationality}</DetailValue><DetailValue label="Preferred language" icon={<Languages />}>{lead.contact?.preferredLanguage}</DetailValue>
          <DetailValue label="Lead source" icon={<Megaphone />}>{sourceName}</DetailValue><DetailValue label="Branch" icon={<Building2 />}>{lead.branch?.name}</DetailValue>
        </dl>{lead.contact?.notes && <div className="mt-6 border-t pt-5"><h3 className="text-xs font-medium">Contact notes</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{lead.contact.notes}</p></div>}</CardContent></Card>

        {data.enquiry && <Card id="enquiry" className="scroll-mt-24 gap-4 py-4 shadow-xs ring-border" data-testid="lead-enquiry"><CardHeader className="px-5 sm:px-6"><div className="flex items-center gap-2"><MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Website enquiry</CardTitle></div><CardDescription>What the visitor sent, received {formatLeadDate(data.enquiry.receivedAt, true)} through {sourceName || "the website"}.</CardDescription></CardHeader><CardContent className="space-y-5 px-5 sm:px-6">
          <div><h3 className="text-xs text-muted-foreground">Message</h3>
            {data.enquiry.message ? <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border bg-muted/40 px-4 py-3 text-sm leading-6">{data.enquiry.message}</p> : <p className="mt-2 text-sm text-muted-foreground">The visitor did not write a message.</p>}</div>
          <dl className="grid gap-5 sm:grid-cols-2" data-testid="lead-enquiry-fields">{enquiryFields(lead).map(field => <div key={field.label}><dt className="text-xs text-muted-foreground">{field.label}</dt><dd className="mt-1.5 break-words text-sm font-medium">{field.value}</dd></div>)}</dl>
          <p className="text-[11px] leading-4 text-muted-foreground">Details as saved on the lead: if your team edits them, the new values show here.</p>
        </CardContent></Card>}

        {callSection}

        <Card id="lead-requirements" className="scroll-mt-24 gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex items-center gap-2"><Building2 className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Property requirements</CardTitle></div><CardDescription>Preferences for this opportunity.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6"><dl className="grid gap-6 sm:grid-cols-2">
          <DetailValue label="Project or property interest" icon={<Home />}>{lead.propertyInterest}</DetailValue><DetailValue label="Preferred location" icon={<MapPin />}>{lead.preferredLocation}</DetailValue>
          <DetailValue label="Property type" icon={<Building2 />}>{lead.propertyType}</DetailValue><DetailValue label="Transaction type" icon={<Flag />}>{lead.transactionType && <span className="capitalize">{lead.transactionType.toLowerCase()}</span>}</DetailValue>
          <DetailValue label="Minimum budget" icon={<Wallet />}>{amount(lead.budgetMin)}</DetailValue><DetailValue label="Maximum budget" icon={<Wallet />}>{amount(lead.budgetMax)}</DetailValue><DetailValue label="Bedrooms" icon={<BedDouble />}>{lead.bedroomPreference}</DetailValue>
        </dl></CardContent></Card>

        {propertySection && <div id="properties" className="scroll-mt-24">{propertySection}</div>}

        <Card id="timeline" className="scroll-mt-24 gap-0 py-5 shadow-xs ring-border"><CardHeader className="border-b px-5 pb-5 sm:px-6"><div className="flex items-center gap-2"><Activity className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Notes and activity</CardTitle></div><CardDescription>Conversations and changes, most recent first. Times are in Dubai.</CardDescription></CardHeader><CardContent className="border-b px-5 py-5 sm:px-6"><LeadNoteForm lead={lead} /></CardContent>
          <CardContent className="px-5 pt-6 sm:px-6">{activities.length === 0 ? <EmptyState icon={MessageSquareText} title="No activity on this page" description="Notes and lead updates will appear here as your team works on this opportunity." className="py-8" /> : <ol aria-label="Lead activity timeline">{activities.map((entry, index) => {
            const description = activityDescription(entry, data);
            const marker = timelineTone(entry.kind);
            return <li key={entry.id} className="relative flex gap-3 pb-6 last:pb-0">{index !== activities.length - 1 && <span className="absolute top-8 bottom-0 left-3.5 w-px bg-border" aria-hidden="true" />}<span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border", marker.tone)}>{marker.icon}</span><div className="min-w-0 flex-1 pt-0.5"><div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><h3 className="text-xs font-semibold">{activityLabels[entry.kind] || "Lead activity"}</h3><time dateTime={entry.createdAt} className="text-[11px] text-muted-foreground">{formatLeadDate(entry.createdAt, true)}</time></div><p className="mt-1 text-[11px] text-muted-foreground">{entry.kind === "WEBSITE_LEAD_CAPTURED" ? "From the website form" : entry.actor?.displayName || "Company member"}</p>{description && <p className="mt-2 text-xs leading-6 text-muted-foreground">{description}</p>}{entry.note && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border bg-muted/25 px-3 py-2.5 text-sm leading-6">{entry.note}</p>}</div></li>;
          })}</ol>}</CardContent>
          {(activityPage > 1 || hasMoreActivities) && <nav aria-label="Activity pagination" className="mt-5 flex items-center justify-between gap-3 border-t px-5 pt-4 sm:px-6"><span className="text-xs text-muted-foreground">Activity page {activityPage}</span><div className="flex gap-2">{activityPage > 1 && <Link href={historyHref(activityPage - 1, followUpPage, "timeline")} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Newer</Link>}{hasMoreActivities && <Link href={historyHref(activityPage + 1, followUpPage, "timeline")} className={buttonVariants({ variant: "outline", size: "sm" })}>Older<ChevronRight aria-hidden="true" /></Link>}</div></nav>}
        </Card>

        <Card id="follow-up-history" className="scroll-mt-24 gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><div className="flex items-center justify-between gap-3"><CardTitle role="heading" aria-level={2}>Follow-up history</CardTitle><Badge variant="outline">{followUpTotal}</Badge></div><CardDescription>Scheduled, completed and cancelled work for this lead.</CardDescription></CardHeader><CardContent className="px-5 sm:px-6">{followUps.length ? <ol className="space-y-3" aria-label="Follow-up history">{followUps.map(followUp => <li key={followUp.id} className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words text-sm font-medium">{followUp.title}</h3><p className="mt-1 text-xs text-muted-foreground">Due <time dateTime={followUp.dueAt}>{formatLeadDate(followUp.dueAt, true)}</time></p>{followUp.assignedUser && <p className="mt-1 text-xs text-muted-foreground">Assigned to {followUp.assignedUser.userProfile?.displayName || followUp.assignedUser.email}</p>}</div><Badge variant="outline" className="capitalize">{followUp.status.toLowerCase()}</Badge></div>{followUp.completedAt && <p className="mt-2 text-xs text-muted-foreground">Completed <time dateTime={followUp.completedAt}>{formatLeadDate(followUp.completedAt, true)}</time></p>}<div className="mt-3"><LeadFollowUpCompletion lead={lead} followUp={followUp} /></div></li>)}</ol> : <EmptyState icon={CalendarClock} title="No follow-ups on this page" description="Schedule a next step to start a history of your work on this lead." className="py-8" />}</CardContent>{(followUpPage > 1 || hasMoreFollowUps) && <nav aria-label="Follow-up pagination" className="flex items-center justify-between gap-3 border-t px-5 pt-4 sm:px-6"><span className="text-xs text-muted-foreground">Page {followUpPage} of {Math.max(1, Math.ceil(followUpTotal / 10))}</span><div className="flex gap-2">{followUpPage > 1 && <Link href={historyHref(activityPage, followUpPage - 1, "follow-up-history")} className={buttonVariants({ variant: "outline", size: "sm" })}><ChevronLeft aria-hidden="true" />Previous</Link>}{hasMoreFollowUps && <Link href={historyHref(activityPage, followUpPage + 1, "follow-up-history")} className={buttonVariants({ variant: "outline", size: "sm" })}>Next<ChevronRight aria-hidden="true" /></Link>}</div></nav>}</Card>
      </div>

      <aside className="space-y-4" aria-label="Lead responsibility and follow-up">
        <Card className="gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><UserRound className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Responsibility</CardTitle></div></CardHeader><CardContent className="px-5"><LeadAssignment data={data} /></CardContent></Card>
        <Card className="gap-4 py-4 shadow-xs ring-border"><CardHeader className="px-5"><div className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" /><CardTitle role="heading" aria-level={2}>Next follow-up</CardTitle></div></CardHeader><CardContent className="px-5"><LeadFollowUp lead={lead} /><p className="mt-4 text-[11px] leading-5 text-muted-foreground">Follow-ups are saved to this company workspace. Email, calendar and push reminders are not connected.</p></CardContent></Card>
        <section aria-label="Lead record information" className="space-y-3 px-1 text-xs text-muted-foreground"><p className="flex items-start gap-2"><Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /><span>Created <time dateTime={lead.createdAt}>{formatLeadDate(lead.createdAt, true)}</time><br /><span className="mt-1 inline-block">Updated <time dateTime={lead.updatedAt}>{formatLeadDate(lead.updatedAt, true)}</time></span></span></p>{lead.leadNumber && <p className="break-all leading-5">Lead reference: {lead.leadNumber}</p>}<p className="leading-5">All times are in Dubai (UTC+4). {["AGENT", "MANAGER"].includes(membership.role) ? "Your access is limited to leads assigned to you." : "Access follows your active company membership."}</p></section>
      </aside>
    </div>
  </div>;
}
