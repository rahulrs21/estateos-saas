"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, Check, LoaderCircle, LockKeyhole, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import type { LeadFormData } from "@/modules/leads/types";
import { createLeadSchema, updateLeadSchema } from "@/modules/leads/validation";
import { fromDubaiDateTimeInput, LeadField, LeadFormMessage, selectClassName, textareaClassName } from "./lead-ui";

/** A single validated editor serves the dialog and directly navigable routes. */
function LeadEditor({ data, onCancel, onSaved, onPendingChange }: {
  data: LeadFormData; onCancel?: () => void; onSaved?: () => void; onPendingChange?: (pending: boolean) => void;
}) {
  const { lead, organization, membership, branches, assignees, canManageAssignments, sources } = data;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const fieldId = (name: string) => `${prefix}-${name}`;
  const cancelHref = lead ? `/leads/${lead.id}` : "/leads";
  const defaultSource = lead?.sourceId ?? (lead?.source ? "legacy" : sources.find(source => source.sourceType === "MANUAL")?.id ?? "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(""); setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const optional = (field: string) => String(form.get(field) ?? "").trim() || null;
    const budget = (field: string) => optional(field) === null ? null : Number(form.get(field));
    const sourceValue = String(form.get("sourceId") ?? "");
    const source = sources.find(entry => entry.id === sourceValue);
    const input = {
      fullName: String(form.get("fullName") ?? ""), email: optional("email"), phone: optional("phone"),
      alternatePhone: optional("alternatePhone"), nationality: optional("nationality"),
      sourceId: sourceValue === "legacy" ? null : sourceValue || null,
      source: source?.name ?? (sourceValue === "legacy" ? lead?.source ?? null : null),
      propertyInterest: optional("propertyInterest"), preferredLocation: optional("preferredLocation"), propertyType: optional("propertyType"),
      transactionType: form.get("transactionType"), budgetMin: budget("budgetMin"), budgetMax: budget("budgetMax"),
      currency: String(form.get("currency") ?? "AED"), bedroomPreference: optional("bedroomPreference"), priority: form.get("priority"),
      branchId: optional("branchId"), assignedMembershipId: canManageAssignments ? optional("assignedMembershipId") : membership.id,
      ...(!lead ? { initialNote: optional("initialNote"), initialFollowUpAt: fromDubaiDateTimeInput(String(form.get("initialFollowUpAt") ?? "")), initialFollowUpNote: optional("initialFollowUpNote") } : {}),
    };
    const parsed = lead ? updateLeadSchema.safeParse({ ...input, leadId: lead.id, status: lead.status }) : createLeadSchema.safeParse(input);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) messages[String(issue.path[0] ?? "budgetMax")] ??= issue.message;
      setFieldErrors(messages); setError(parsed.error.issues.find(issue => issue.path.length === 0)?.message ?? "Review the highlighted fields and try again.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setPending(true); onPendingChange?.(true);
    try {
      const body = { ...parsed.data };
      if ("leadId" in body) delete (body as { leadId?: string }).leadId;
      const result = await leadRequest<{ lead: { id: string }; possibleDuplicates?: unknown[]; warnings?: string[] }>(lead ? `/api/leads/${lead.id}` : "/api/leads", lead ? "PATCH" : "POST", body, organization.id);
      toast.success(lead ? "Lead updated." : "Lead created.");
      if (result.possibleDuplicates?.length) toast.warning("Possible duplicate contact", { description: "A matching contact already exists. Review the separate records before adding another lead for this person." });
      for (const warning of result.warnings ?? []) toast.warning(warning);
      onSaved?.(); router.push(`/leads/${encodeURIComponent(result.lead.id)}`); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't save this lead. Please try again."); }
    finally { setPending(false); onPendingChange?.(false); }
  }

  const inputProps = (name: string) => ({ id: fieldId(name), name, "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] || ["phone", "initialFollowUpAt", "assignedMembershipId"].includes(name) ? `${fieldId(name)}-message` : undefined, className: "h-10" });
  const field = (name: string, label: string, children: ReactNode, hint?: string) => <LeadField id={fieldId(name)} label={label} error={fieldErrors[name]} hint={hint}>{children}</LeadField>;
  if (lead?.archivedAt) return <LeadFormMessage message="This lead is archived. Its history is available, but the record cannot be edited." />;
  return <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending} className="space-y-6">
    <LeadFormMessage message={error} />
    <fieldset disabled={pending} className="min-w-0 space-y-6"><legend className="sr-only">Lead details</legend>
      <section className="space-y-4" aria-labelledby={`${prefix}-contact-heading`}>
        <div><h2 id={`${prefix}-contact-heading`} className="text-sm font-semibold">Customer information</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Contact details stay within {organization.name}. Fields marked * are required.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{field("fullName", "Full name *", <Input {...inputProps("fullName")} defaultValue={lead?.fullName ?? ""} autoComplete="name" maxLength={160} required />)}</div>
          {field("phone", "Phone number", <Input {...inputProps("phone")} type="tel" autoComplete="tel" defaultValue={lead?.phone ?? ""} maxLength={32} placeholder="+971 50 123 4567" />, "Include the country code when known.")}
          {field("email", "Email address", <Input {...inputProps("email")} type="email" autoComplete="email" defaultValue={lead?.email ?? ""} maxLength={254} placeholder="name@example.com" />)}
          {field("alternatePhone", "Alternate phone", <Input {...inputProps("alternatePhone")} type="tel" autoComplete="tel-national" defaultValue={lead?.contact?.alternatePhone ?? ""} maxLength={32} placeholder="+971 50 123 4567" />, "Optional secondary contact number.")}
          {field("nationality", "Nationality", <Input {...inputProps("nationality")} autoComplete="country-name" defaultValue={lead?.contact?.nationality ?? ""} maxLength={80} placeholder="For example, Emirati" />)}
        </div>
      </section>
      <section className="space-y-4 border-t pt-5" aria-labelledby={`${prefix}-requirements-heading`}>
        <div><h2 id={`${prefix}-requirements-heading`} className="text-sm font-semibold">Property requirements</h2><p className="mt-1 text-xs text-muted-foreground">Capture what the customer is looking for.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("propertyInterest", "Project or property interest", <Input {...inputProps("propertyInterest")} defaultValue={lead?.propertyInterest ?? ""} maxLength={500} placeholder="Project name or requirement" />)}
          {field("preferredLocation", "Preferred location", <Input {...inputProps("preferredLocation")} defaultValue={lead?.preferredLocation ?? ""} maxLength={160} placeholder="Area or community" />)}
          {field("propertyType", "Property type", <Input {...inputProps("propertyType")} defaultValue={lead?.propertyType ?? ""} maxLength={80} placeholder="Apartment, villa, office…" list={`${prefix}-property-types`} />)}
          <datalist id={`${prefix}-property-types`}>{["Apartment", "Villa", "Townhouse", "Penthouse", "Office", "Retail", "Land"].map(value => <option key={value} value={value} />)}</datalist>
          {field("transactionType", "Transaction type", <select {...inputProps("transactionType")} defaultValue={lead?.transactionType ?? "BUY"} className={selectClassName}><option value="BUY">Buy</option><option value="RENT">Rent</option><option value="INVEST">Invest</option></select>)}
          {field("budgetMin", "Minimum budget", <Input {...inputProps("budgetMin")} type="number" min={0} max={1000000000000} step="0.01" inputMode="decimal" defaultValue={lead?.budgetMin ?? ""} placeholder="No minimum" />)}
          {field("budgetMax", "Maximum budget", <Input {...inputProps("budgetMax")} type="number" min={0} max={1000000000000} step="0.01" inputMode="decimal" defaultValue={lead?.budgetMax ?? ""} placeholder="No maximum" />)}
          {field("currency", "Currency", <Input {...inputProps("currency")} defaultValue={lead?.currency ?? "AED"} maxLength={3} pattern="[A-Za-z]{3}" />)}
          {field("bedroomPreference", "Bedrooms", <Input {...inputProps("bedroomPreference")} defaultValue={lead?.bedroomPreference ?? ""} maxLength={40} placeholder="Studio, 2, 3+…" />)}
        </div>
      </section>
      <section className="space-y-4 border-t pt-5" aria-labelledby={`${prefix}-responsibility-heading`}>
        <h2 id={`${prefix}-responsibility-heading`} className="text-sm font-semibold">Source and responsibility</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("sourceId", "Lead source", <select {...inputProps("sourceId")} defaultValue={defaultSource} className={selectClassName}><option value="">Manual / not specified</option>{lead?.source && !lead.sourceId && <option value="legacy">{lead.source} (existing)</option>}{sources.map(source => <option key={source.id} value={source.id}>{source.name}</option>)}</select>)}
          {field("priority", "Priority", <select {...inputProps("priority")} defaultValue={lead?.priority ?? "NORMAL"} className={selectClassName}>{["LOW", "NORMAL", "HIGH", "URGENT"].map(value => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select>)}
          {field("branchId", "Branch", <select {...inputProps("branchId")} defaultValue={lead?.branchId ?? ""} className={selectClassName}><option value="">No branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>)}
          {canManageAssignments ? field("assignedMembershipId", "Assigned agent", <select {...inputProps("assignedMembershipId")} defaultValue={lead?.assignedMembershipId ?? ""} className={selectClassName}><option value="">Unassigned</option>{assignees.map(assignee => <option key={assignee.id} value={assignee.id}>{assignee.userProfile?.displayName || assignee.email}</option>)}</select>, lead ? "Only active company agents can be assigned. Choose Unassigned to clear the assignment." : membership.role === "OWNER" || membership.role === "ADMIN" ? "Leave Unassigned to use the company Round Robin rule when enabled and matched. Otherwise, the lead stays in the unassigned queue." : "Automatic Round Robin runs for owner/admin lead creation. This lead is assigned to you.") : <div className="space-y-2"><p className="text-xs font-medium">Assigned agent</p><p className="flex h-10 items-center gap-2 rounded-lg border bg-muted/30 px-3 text-sm"><LockKeyhole className="size-3.5 text-muted-foreground" aria-hidden="true" />You</p><p className="text-xs text-muted-foreground">You can work on leads assigned to you.</p></div>}
        </div>
      </section>
      {!lead && <section className="space-y-4 border-t pt-5" aria-labelledby={`${prefix}-next-step-heading`}>
        <div><h2 id={`${prefix}-next-step-heading`} className="text-sm font-semibold">Notes and next step</h2><p className="mt-1 text-xs text-muted-foreground">Optional. These will be saved with the lead.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("initialFollowUpAt", "Next follow-up", <Input {...inputProps("initialFollowUpAt")} type="datetime-local" />, "Dubai time (UTC+4). Within the next year.")}
          {field("initialFollowUpNote", "Follow-up title", <Input {...inputProps("initialFollowUpNote")} maxLength={500} placeholder="Call to discuss requirements" />)}
          <div className="sm:col-span-2">{field("initialNote", "Initial notes", <textarea {...inputProps("initialNote")} className={textareaClassName} maxLength={4000} placeholder="Conversation summary, requirements or preferences…" />)}</div>
        </div>
      </section>}
      {lead && <p className="rounded-lg border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">Use the lead details page to change pipeline stage, add notes and manage follow-ups. Existing history is preserved when you save.</p>}
    </fieldset>
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t bg-background py-4"><p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true" />{organization.name}</p><div className="flex gap-2">{onCancel ? <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button> : <Link href={cancelHref} className={buttonVariants({ variant: "outline" })} aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }}>Cancel</Link>}<Button type="submit" disabled={pending} className="min-w-32">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : lead ? "Save changes" : "Create lead"}</Button></div></div>
  </form>;
}

export function LeadEditorDialog({ data, children }: { data: LeadFormData; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return <Dialog open={open} onOpenChange={next => { if (!pending) setOpen(next); }}><DialogTrigger render={<Button variant={data.lead ? "outline" : "default"} size="lg" disabled={Boolean(data.lead?.archivedAt)} />}>{data.lead ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}{children ?? (data.lead ? "Edit lead" : "Create lead")}</DialogTrigger><DialogContent showCloseButton={!pending} className="max-h-[92dvh] max-w-[calc(100%-1rem)] gap-5 overflow-y-auto p-5 sm:max-w-3xl sm:p-6"><DialogHeader className="pr-6"><DialogTitle className="text-xl">{data.lead ? "Edit lead" : "Create a lead"}</DialogTitle><DialogDescription>{data.lead ? "Update customer information and property requirements." : "Capture a new opportunity in your company workspace."}</DialogDescription></DialogHeader><LeadEditor key={data.lead?.updatedAt ?? "new"} data={data} onCancel={() => setOpen(false)} onSaved={() => setOpen(false)} onPendingChange={setPending} /></DialogContent></Dialog>;
}

export function LeadForm({ data }: { data: LeadFormData }) {
  return <div className="mx-auto max-w-3xl space-y-6"><Link href={data.lead ? `/leads/${data.lead.id}` : "/leads"} className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to {data.lead ? "lead" : "leads"}</Link><PageHeader title={data.lead ? "Edit lead" : "Create a lead"} eyebrow={data.organization.name} description="Customer information, requirements and responsibility." /><Card className="py-5 shadow-xs ring-border"><CardContent className="px-5 sm:px-6"><LeadEditor key={data.lead?.updatedAt ?? "new"} data={data} /></CardContent></Card></div>;
}
