"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, CheckCheck, LoaderCircle, MessageSquarePlus, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import type { LeadDetailData, LeadFollowUpRecord, LeadPipeline, LeadRecord, LeadStatus } from "@/modules/leads/types";
import { leadAssignmentInputSchema, leadNoteInputSchema } from "@/modules/leads/validation";
import { createFollowUpSchema } from "@/modules/leads/crm-validation";
import { cn } from "@/lib/utils";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, leadStatusLabels, leadStatusOptions, selectClassName, textareaClassName } from "./lead-ui";

function useLeadMutation(lead: LeadRecord) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function save(suffix: string, method: "POST" | "PATCH", body: unknown, message: string) {
    if (pending || lead.archivedAt) return false;
    setPending(true); setError(""); setSuccess("");
    try {
      await leadRequest(`/api/leads/${lead.id}/${suffix}`, method, body, lead.organizationId);
      setSuccess(message); toast.success(message); router.refresh(); return true;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This change couldn't be saved. Please try again."); return false; }
    finally { setPending(false); }
  }
  return { save, pending, error, success, setError };
}

export function LeadStatusPipeline({ lead, pipelines = [] }: { lead: LeadRecord; pipelines?: LeadPipeline[] }) {
  const action = useLeadMutation(lead);
  const pipeline = pipelines.find(entry => entry.id === lead.pipelineId) ?? (!lead.pipelineId ? pipelines.find(entry => entry.isDefault) : undefined);
  const terminal = ["WON", "LOST", "CONVERTED"].includes(lead.status);
  const stages = pipeline?.stages.slice().sort((a, b) => a.position - b.position);
  // Legacy rows acquire their default pipeline through the compatibility status
  // mutation. Only linked rows send stage identifiers to the stage endpoint.
  const usesStageIds = Boolean(lead.pipelineId && stages?.length);
  return <div className="space-y-4" aria-busy={action.pending}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8" role="group" aria-label="Change lead status">
      {(stages?.length ? stages.map(stage => ({ id: stage.id, name: stage.name, selected: stage.id === lead.pipelineStageId || (!lead.pipelineStageId && stage.status === lead.status) || (lead.status === "CONVERTED" && stage.status === "WON"), status: stage.status })) : leadStatusOptions.filter(status => status !== "CONVERTED" || lead.status === "CONVERTED").map(status => ({ id: status, name: leadStatusLabels[status], selected: status === lead.status, status }))).map(stage => <button type="button" key={stage.id} aria-pressed={stage.selected} disabled={action.pending || stage.selected || terminal || Boolean(lead.archivedAt)} onClick={() => action.save(usesStageIds ? "stage" : "status", usesStageIds ? "POST" : "PATCH", usesStageIds ? { pipelineStageId: stage.id } : { status: stage.status as LeadStatus }, `Pipeline moved to ${stage.name.toLowerCase()}.`)} className={cn("flex min-h-12 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default", stage.selected ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted disabled:opacity-50")}>
        {stage.selected && <Check className="size-3 shrink-0" aria-hidden="true" />}{stage.name}
      </button>)}
    </div>
    {terminal && <p className="text-xs leading-5 text-muted-foreground">This opportunity has reached its final stage. Closed leads retain their contact information and history.</p>}
    {lead.archivedAt && <p className="text-xs text-muted-foreground">Archived leads cannot be changed.</p>}
    {action.pending && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Updating pipeline…</p>}
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </div>;
}

export function LeadAssignment({ data }: { data: LeadDetailData }) {
  const { lead, assignees, canManageAssignments } = data;
  const action = useLeadMutation(lead);
  const id = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = form.get("assignedMembershipId");
    const parsed = leadAssignmentInputSchema.safeParse({
      leadId: lead.id,
      assignedMembershipId: value || null,
      reason: form.get("reason"),
      overrideClosed: form.get("overrideClosed") === "on",
    });
    if (!parsed.success) { action.setError("Choose a valid active company member."); return; }
    await action.save("assignment", "PATCH", {
      assignedMembershipId: parsed.data.assignedMembershipId,
      reason: parsed.data.reason,
      overrideClosed: parsed.data.overrideClosed,
    }, parsed.data.assignedMembershipId ? "Lead assignment updated." : "Lead moved to the unassigned queue.");
  }
  if (!canManageAssignments || lead.archivedAt) return <div><p className="text-sm font-medium">{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{lead.archivedAt ? "This lead is archived." : "An owner, administrator or a manager with access to this lead can change its assignment."}</p></div>;
  const closed = ["WON", "LOST", "CONVERTED"].includes(lead.status);
  const canOverrideClosed = ["OWNER", "ADMIN"].includes(data.membership.role);
  return <form onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
    <LeadField id={id} label="Assigned agent"><select key={`${lead.id}:${lead.assignedMembershipId ?? "unassigned"}`} id={id} name="assignedMembershipId" defaultValue={lead.assignedMembershipId ?? ""} disabled={action.pending} className={selectClassName}><option value="">Unassigned</option>{assignees.map(assignee => <option key={assignee.id} value={assignee.id}>{assignee.userProfile?.displayName || assignee.email}</option>)}</select></LeadField>
    <LeadField id={`${id}-reason`} label="Assignment reason"><Input id={`${id}-reason`} name="reason" maxLength={500} defaultValue="Manual assignment" required disabled={action.pending} className="h-10" /></LeadField>
    {closed && canOverrideClosed && <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><input type="checkbox" name="overrideClosed" className="mt-0.5 size-4 accent-primary" disabled={action.pending} />Allow this explicit reassignment on a closed lead</label>}
    <p className="text-xs leading-5 text-muted-foreground">Only active agents in this company can be assigned. Managers can reassign leads they are authorized to access.</p>
    <Button type="submit" variant="outline" disabled={action.pending} className="w-full">{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}{action.pending ? "Saving…" : "Save assignment"}</Button>
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </form>;
}

export function LeadNoteForm({ lead }: { lead: LeadRecord }) {
  const action = useLeadMutation(lead);
  const id = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const parsed = leadNoteInputSchema.safeParse({ leadId: lead.id, note: new FormData(form).get("note") });
    if (!parsed.success) { action.setError("Enter a note between 1 and 4,000 characters."); return; }
    if (await action.save("notes", "POST", { note: parsed.data.note }, "Note added to the timeline.")) form.reset();
  }
  if (lead.archivedAt) return <p className="text-xs text-muted-foreground">This lead is archived. Its notes and activity remain available below.</p>;
  return <form onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
    <LeadField id={id} label="Add a note"><textarea id={id} name="note" maxLength={4000} required disabled={action.pending} placeholder="Record a conversation, preference or next step…" className={textareaClassName} /></LeadField>
    <div className="flex flex-wrap items-start justify-between gap-3"><p className="max-w-sm text-xs leading-5 text-muted-foreground">Visible to members who are authorized to access this lead.</p><Button type="submit" disabled={action.pending}>{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <MessageSquarePlus aria-hidden="true" />}{action.pending ? "Adding…" : "Add note"}</Button></div>
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </form>;
}

/** The plural endpoint adds independent follow-ups without replacing other work. */
export function LeadFollowUp({ lead }: { lead: LeadRecord }) {
  const action = useLeadMutation(lead);
  const prefix = useId();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const fields = new FormData(form);
    const parsed = createFollowUpSchema.safeParse({ leadId: lead.id, dueAt: fromDubaiDateTimeInput(String(fields.get("dueAt") ?? "")), title: String(fields.get("title") ?? "") });
    if (!parsed.success) { action.setError(parsed.error.issues[0]?.message ?? "Choose a valid follow-up date and title."); return; }
    if (await action.save("follow-ups", "POST", { dueAt: parsed.data.dueAt, title: parsed.data.title }, "Follow-up scheduled.")) form.reset();
  }
  return <div className="space-y-4">
    {lead.followUpAt ? <div className="rounded-lg border border-primary/15 bg-primary/5 p-3"><p className="flex items-start gap-2 text-sm font-medium text-primary"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt, true)}</time></p>{lead.followUpNote && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{lead.followUpNote}</p>}</div> : <p className="text-sm leading-6 text-muted-foreground">No follow-up scheduled.</p>}
    {!lead.archivedAt && <form onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
      <LeadField id={`${prefix}-title`} label="Follow-up title"><Input id={`${prefix}-title`} name="title" maxLength={500} required disabled={action.pending} placeholder="Call to discuss requirements" className="h-10" /></LeadField>
      <LeadField id={`${prefix}-date`} label="Follow-up date and time" hint="Dubai time (UTC+4). Choose a future date within one year."><Input id={`${prefix}-date`} name="dueAt" type="datetime-local" required disabled={action.pending} aria-describedby={`${prefix}-date-message`} className="h-10" /></LeadField>
      <Button type="submit" disabled={action.pending} className="w-full">{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}{action.pending ? "Saving…" : "Schedule follow-up"}</Button>
    </form>}
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </div>;
}

export function LeadFollowUpCompletion({ lead, followUp }: { lead: LeadRecord; followUp: LeadFollowUpRecord }) {
  const action = useLeadMutation(lead);
  if (followUp.status !== "PENDING" || lead.archivedAt) return null;
  return <div className="space-y-2"><Button type="button" variant="outline" size="sm" disabled={action.pending || Boolean(action.success)} onClick={() => action.save(`follow-ups/${followUp.id}/complete`, "POST", {}, "Follow-up marked complete.")}>{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}{action.success ? "Completed" : "Complete follow-up"}</Button><LeadFormMessage message={action.error} /></div>;
}
