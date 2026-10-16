"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, LoaderCircle, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import type { LeadFormData } from "@/modules/leads/types";
import { createLeadSchema, updateLeadSchema } from "@/modules/leads/validation";
import { LeadField, LeadFormMessage, leadStatusLabels, leadStatusOptions, selectClassName } from "./lead-ui";

export function LeadForm({ data }: { data: LeadFormData }) {
  const { lead, organization, membership, branches, assignees, canManageAssignments } = data;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const cancelHref = lead ? `/workspace/leads/${lead.id}` : "/workspace/leads";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const optional = (field: string) => String(form.get(field) ?? "").trim() || null;
    const input = {
      fullName: String(form.get("fullName") ?? ""),
      email: optional("email"), phone: optional("phone"), source: optional("source"),
      branchId: optional("branchId"),
      assignedMembershipId: canManageAssignments ? optional("assignedMembershipId") : membership.id,
    };
    const parsed = lead
      ? updateLeadSchema.safeParse({ ...input, leadId: lead.id, status: form.get("status") })
      : createLeadSchema.safeParse(input);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) messages[String(issue.path[0])] ??= issue.message;
      setFieldErrors(messages);
      setError("Review the highlighted fields and try again.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setPending(true);
    try {
      const body = { ...parsed.data };
      // The route is the authoritative record identifier; do not send a second ID.
      if ("leadId" in body) delete (body as { leadId?: string }).leadId;
      const result = await leadRequest<{ lead: { id: string } }>(lead ? `/api/leads/${lead.id}` : "/api/leads", lead ? "PATCH" : "POST", body, organization.id);
      toast.success(lead ? "Lead updated." : "Lead created.");
      router.push(`/workspace/leads/${encodeURIComponent(result.lead.id)}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save this lead. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const describedBy = (field: string) => fieldErrors[field] ? `${field}-message` : undefined;
  return <div className="mx-auto max-w-4xl space-y-6">
    <Link href={cancelHref} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />{lead ? "Back to lead" : "Back to leads"}</Link>
    <PageHeader title={lead ? "Edit lead" : "Create a lead"} eyebrow={organization.name} description={lead ? "Keep contact information and responsibility up to date." : "Capture the essentials. Notes and follow-ups can be added after saving."} />
    <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
      <LeadFormMessage message={error} />
      <fieldset disabled={pending} className="min-w-0 space-y-5">
        <legend className="sr-only">Lead details</legend>
        <Card className="gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Contact information</CardTitle><CardDescription>Use the details your prospect has shared with your agency.</CardDescription></CardHeader><CardContent className="grid gap-5 px-5 sm:grid-cols-2 sm:px-6">
          <div className="sm:col-span-2"><LeadField id="fullName" label="Full name *" error={fieldErrors.fullName}><Input id="fullName" name="fullName" defaultValue={lead?.fullName ?? ""} autoComplete="name" maxLength={160} required aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={describedBy("fullName")} className="h-10" /></LeadField></div>
          <LeadField id="email" label="Email address" error={fieldErrors.email}><Input id="email" name="email" type="email" autoComplete="email" defaultValue={lead?.email ?? ""} maxLength={254} aria-invalid={Boolean(fieldErrors.email)} aria-describedby={describedBy("email")} className="h-10" /></LeadField>
          <LeadField id="phone" label="Phone number" error={fieldErrors.phone} hint="Include the country code, for example +971."><Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={lead?.phone ?? ""} maxLength={32} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby="phone-message" className="h-10" /></LeadField>
          <LeadField id="source" label="Lead source" error={fieldErrors.source}><Input id="source" name="source" defaultValue={lead?.source ?? ""} maxLength={120} placeholder="e.g. Referral or website enquiry" aria-invalid={Boolean(fieldErrors.source)} aria-describedby={describedBy("source")} className="h-10" /></LeadField>
          {lead && <LeadField id="status" label="Status" error={fieldErrors.status}><select id="status" name="status" defaultValue={lead.status} aria-invalid={Boolean(fieldErrors.status)} aria-describedby={describedBy("status")} className={selectClassName}>{leadStatusOptions.map((status) => <option key={status} value={status}>{leadStatusLabels[status]}</option>)}</select></LeadField>}
        </CardContent></Card>

        <Card className="gap-5 py-5 shadow-xs ring-border"><CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Responsibility</CardTitle><CardDescription>Branches and assignees belong to {organization.name}.</CardDescription></CardHeader><CardContent className="grid gap-5 px-5 sm:grid-cols-2 sm:px-6">
          <LeadField id="branchId" label="Branch" error={fieldErrors.branchId}><select id="branchId" name="branchId" defaultValue={lead?.branchId ?? ""} aria-invalid={Boolean(fieldErrors.branchId)} aria-describedby={describedBy("branchId")} className={selectClassName}><option value="">No branch</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></LeadField>
          {canManageAssignments ? <LeadField id="assignedMembershipId" label="Assigned agent" error={fieldErrors.assignedMembershipId} hint="Only active organization members can be assigned."><select id="assignedMembershipId" name="assignedMembershipId" defaultValue={lead?.assignedMembershipId ?? ""} aria-invalid={Boolean(fieldErrors.assignedMembershipId)} aria-describedby="assignedMembershipId-message" className={selectClassName}><option value="">Unassigned</option>{assignees.map((assignee) => <option key={assignee.id} value={assignee.id}>{assignee.userProfile?.displayName || assignee.email} · {assignee.role.toLowerCase()}</option>)}</select></LeadField> : <div className="space-y-2"><p className="text-xs font-medium">Assigned agent</p><div className="flex min-h-10 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm"><LockKeyhole className="size-3.5 text-muted-foreground" aria-hidden="true" />You</div><p className="text-xs leading-5 text-muted-foreground">Your membership can create and update leads assigned to you.</p></div>}
        </CardContent></Card>
      </fieldset>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-card p-4 sm:px-5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-3.5" aria-hidden="true" />Saved to {organization.name}</p><div className="flex gap-2"><Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>Cancel</Link><Button type="submit" disabled={pending} size="lg" className="min-w-32">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : lead ? "Save changes" : "Create lead"}</Button></div></div>
    </form>
  </div>;
}
