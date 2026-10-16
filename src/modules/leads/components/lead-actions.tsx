"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, CheckCheck, LoaderCircle, MessageSquarePlus, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import type { LeadDetailData, LeadRecord, LeadStatus } from "@/modules/leads/types";
import { leadAssignmentInputSchema, leadFollowUpInputSchema, leadNoteInputSchema } from "@/modules/leads/validation";
import { cn } from "@/lib/utils";
import { formatLeadDate, fromDubaiDateTimeInput, LeadField, LeadFormMessage, leadStatusLabels, leadStatusOptions, selectClassName, textareaClassName, toDubaiDateTimeInput } from "./lead-ui";

function useLeadMutation(lead: LeadRecord) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function save(suffix: string, method: "POST" | "PATCH", body: unknown, message: string) {
    if (pending) return false;
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await leadRequest(`/api/leads/${lead.id}/${suffix}`, method, body, lead.organizationId);
      setSuccess(message);
      toast.success(message);
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This change couldn't be saved. Please try again.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { save, pending, error, success, setError };
}

export function LeadStatusPipeline({ lead }: { lead: LeadRecord }) {
  const action = useLeadMutation(lead);
  return <div className="space-y-4" aria-busy={action.pending}>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" role="group" aria-label="Change lead status">{leadStatusOptions.map((status: LeadStatus) => <button type="button" key={status} aria-pressed={lead.status === status} disabled={action.pending || lead.status === status} onClick={() => action.save("status", "PATCH", { status }, `Status changed to ${leadStatusLabels[status].toLowerCase()}.`)} className={cn("flex min-h-12 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default", lead.status === status ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/30 hover:bg-muted disabled:opacity-50")}>
      {lead.status === status && <Check className="size-3.5" aria-hidden="true" />}{leadStatusLabels[status]}
    </button>)}</div>
    {action.pending && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />Updating status…</p>}
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </div>;
}

export function LeadAssignment({ data }: { data: LeadDetailData }) {
  const { lead, assignees, canManageAssignments } = data;
  const action = useLeadMutation(lead);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("assignedMembershipId");
    const parsed = leadAssignmentInputSchema.safeParse({ leadId: lead.id, assignedMembershipId: value || null });
    if (!parsed.success) { action.setError("Choose a valid active organization member."); return; }
    await action.save("assignment", "PATCH", { assignedMembershipId: parsed.data.assignedMembershipId }, "Lead assignment updated.");
  }
  if (!canManageAssignments) return <div><p className="text-sm font-medium">{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Assigned to you"}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">An owner, administrator or manager can change this assignment.</p></div>;
  return <form onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
    <LeadField id="detail-assignee" label="Assigned agent"><select key={`${lead.id}:${lead.assignedMembershipId ?? "unassigned"}`} id="detail-assignee" name="assignedMembershipId" defaultValue={lead.assignedMembershipId ?? ""} disabled={action.pending} className={selectClassName}><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.userProfile?.displayName || assignee.email}</option>)}</select></LeadField>
    <p className="text-xs leading-5 text-muted-foreground">Only active organization members can be assigned.</p>
    <Button type="submit" variant="outline" disabled={action.pending} className="w-full">{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <UserRoundCheck aria-hidden="true" />}{action.pending ? "Saving…" : "Save assignment"}</Button>
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </form>;
}

export function LeadNoteForm({ lead }: { lead: LeadRecord }) {
  const action = useLeadMutation(lead);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = leadNoteInputSchema.safeParse({ leadId: lead.id, note: new FormData(form).get("note") });
    if (!parsed.success) { action.setError("Enter a note between 1 and 4,000 characters."); return; }
    if (await action.save("notes", "POST", { note: parsed.data.note }, "Note added to the timeline.")) form.reset();
  }
  return <form onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
    <LeadField id="lead-note" label="Add a note"><textarea id="lead-note" name="note" maxLength={4000} required disabled={action.pending} placeholder="Record a conversation, preference or next step…" className={textareaClassName} /></LeadField>
    <div className="flex items-start justify-between gap-4"><p className="max-w-sm text-xs leading-5 text-muted-foreground">Notes are visible to members who can access this lead.</p><Button type="submit" disabled={action.pending} className="shrink-0">{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <MessageSquarePlus aria-hidden="true" />}{action.pending ? "Adding…" : "Add note"}</Button></div>
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </form>;
}

export function LeadFollowUp({ lead }: { lead: LeadRecord }) {
  const action = useLeadMutation(lead);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const note = String(fields.get("followUpNote") ?? "").trim();
    const parsed = leadFollowUpInputSchema.safeParse({ leadId: lead.id, followUpAt: fromDubaiDateTimeInput(String(fields.get("followUpAt") ?? "")), followUpNote: note || null });
    if (!parsed.success) { action.setError(parsed.error.issues[0]?.message ?? "Choose a valid follow-up date."); return; }
    await action.save("follow-up", "POST", { followUpAt: parsed.data.followUpAt, followUpNote: parsed.data.followUpNote }, "Follow-up scheduled.");
  }
  return <div className="space-y-4">
    {lead.followUpAt && <div className="rounded-lg border border-primary/15 bg-primary/5 p-3"><p className="flex items-start gap-2 text-sm font-medium text-primary"><CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt, true)}</time></p>{lead.followUpNote && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{lead.followUpNote}</p>}<Button type="button" size="sm" variant="outline" className="mt-3" disabled={action.pending} onClick={() => action.save("follow-up", "PATCH", {}, "Follow-up marked complete.")}><CheckCheck aria-hidden="true" />Mark complete</Button></div>}
    {!lead.followUpAt && <p className="text-sm leading-6 text-muted-foreground">No follow-up scheduled. Set the next step to keep this relationship moving.</p>}
    <form key={`${lead.id}:${lead.followUpAt ?? "unscheduled"}:${lead.followUpNote ?? ""}`} onSubmit={submit} className="space-y-3" aria-busy={action.pending}>
      <LeadField id="follow-up-date" label={lead.followUpAt ? "Reschedule follow-up" : "Follow-up date and time"} hint="Dubai time (UTC+4). Choose a future date within one year."><Input id="follow-up-date" name="followUpAt" type="datetime-local" defaultValue={toDubaiDateTimeInput(lead.followUpAt)} required disabled={action.pending} aria-describedby="follow-up-date-message" className="h-10" /></LeadField>
      <LeadField id="follow-up-note" label="Next step (optional)"><textarea id="follow-up-note" name="followUpNote" defaultValue={lead.followUpNote ?? ""} maxLength={500} disabled={action.pending} className={cn(textareaClassName, "min-h-20")} placeholder="What should happen next?" /></LeadField>
      <Button type="submit" disabled={action.pending} className="w-full">{action.pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}{action.pending ? "Saving…" : lead.followUpAt ? "Update follow-up" : "Schedule follow-up"}</Button>
    </form>
    <LeadFormMessage message={action.error} /><LeadFormMessage message={action.success} success />
  </div>;
}
