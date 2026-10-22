"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { createContactSchema, updateContactSchema } from "@/modules/leads/crm-validation";
import type { ContactRecord } from "../types";

const fieldClass = "h-10";
const textareaClass = "min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive";

export function ContactEditorDialog({ organization, contact }: { organization: { id: string; name: string }; contact?: ContactRecord }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const prefix = useId();
  const router = useRouter();
  const inputId = (name: string) => `${prefix}-${name}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const optional = (name: string) => String(form.get(name) ?? "").trim() || null;
    const fields = {
      fullName: String(form.get("fullName") ?? ""),
      email: optional("email"), phone: optional("phone"), alternatePhone: optional("alternatePhone"),
      nationality: optional("nationality"), preferredLanguage: String(form.get("preferredLanguage") ?? "en"),
      notes: optional("notes"),
    };
    const parsed = contact
      ? updateContactSchema.safeParse({ ...fields, contactId: contact.id })
      : createContactSchema.safeParse(fields);
    if (!parsed.success) {
      const messages: Record<string, string> = {};
      for (const issue of parsed.error.issues) messages[String(issue.path[0] ?? "fullName")] ??= issue.message;
      setFieldErrors(messages); setError("Review the highlighted fields and try again.");
      return;
    }
    setPending(true);
    try {
      const body: Record<string, unknown> = { ...parsed.data };
      delete body.contactId;
      const response = await leadRequest<{ contact?: { id: string }; possibleDuplicates?: unknown[]; warnings?: string[] }>(
        contact ? `/api/contacts/${encodeURIComponent(contact.id)}` : "/api/contacts",
        contact ? "PATCH" : "POST",
        body,
        organization.id,
      );
      toast.success(contact ? "Contact updated." : "Contact created.");
      if (response.possibleDuplicates?.length) toast.warning("Possible duplicate contact", { description: "A similar company contact already exists. Review the existing record before merging." });
      for (const warning of response.warnings ?? []) toast.warning(warning);
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save this contact. Please try again.");
    } finally { setPending(false); }
  }

  const field = (name: string, label: string, node: ReactNode, hint?: string) => <div className="space-y-2">
    <Label htmlFor={inputId(name)} className="text-xs font-medium">{label}</Label>
    {node}
    {fieldErrors[name] ? <p className="text-xs text-destructive">{fieldErrors[name]}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
  </div>;

  return <Dialog open={open} onOpenChange={next => { if (!pending) { setOpen(next); setError(""); setFieldErrors({}); } }}>
    <DialogTrigger render={<Button variant={contact ? "outline" : "default"} size={contact ? "default" : "lg"} />}>{contact ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}{contact ? "Edit contact" : "Add contact"}</DialogTrigger>
    <DialogContent showCloseButton={!pending} className="max-h-[92dvh] max-w-[calc(100%-1rem)] gap-5 overflow-y-auto p-5 sm:max-w-2xl sm:p-6">
      <DialogHeader className="pr-6"><DialogTitle className="text-xl">{contact ? "Edit contact" : "Add a contact"}</DialogTitle><DialogDescription>Contact details are visible only within {organization.name} according to company permissions.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
        <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          {field("fullName", "Full name *", <Input id={inputId("fullName")} name="fullName" className={fieldClass} autoComplete="name" required maxLength={160} defaultValue={contact?.fullName ?? ""} aria-invalid={Boolean(fieldErrors.fullName)} />)}
          {field("email", "Email address", <Input id={inputId("email")} name="email" type="email" className={fieldClass} autoComplete="email" maxLength={254} defaultValue={contact?.email ?? ""} aria-invalid={Boolean(fieldErrors.email)} />)}
          {field("phone", "Phone number", <Input id={inputId("phone")} name="phone" type="tel" className={fieldClass} autoComplete="tel" maxLength={32} placeholder="+971 50 123 4567" defaultValue={contact?.phone ?? ""} aria-invalid={Boolean(fieldErrors.phone)} />, "Include a country code when known.")}
          {field("alternatePhone", "Alternate phone", <Input id={inputId("alternatePhone")} name="alternatePhone" type="tel" className={fieldClass} autoComplete="tel-national" maxLength={32} defaultValue={contact?.alternatePhone ?? ""} aria-invalid={Boolean(fieldErrors.alternatePhone)} />)}
          {field("nationality", "Nationality", <Input id={inputId("nationality")} name="nationality" className={fieldClass} maxLength={80} defaultValue={contact?.nationality ?? ""} aria-invalid={Boolean(fieldErrors.nationality)} />)}
          {field("preferredLanguage", "Preferred language", <Input id={inputId("preferredLanguage")} name="preferredLanguage" className={fieldClass} maxLength={35} placeholder="en" defaultValue={contact?.preferredLanguage ?? "en"} aria-invalid={Boolean(fieldErrors.preferredLanguage)} />)}
          <div className="sm:col-span-2">{field("notes", "Notes", <textarea id={inputId("notes")} name="notes" className={textareaClass} maxLength={4000} defaultValue={contact?.notes ?? ""} aria-invalid={Boolean(fieldErrors.notes)} />)}</div>
        </fieldset>
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : contact ? <Save aria-hidden="true" /> : <Plus aria-hidden="true" />}{pending ? "Saving…" : contact ? "Save changes" : "Create contact"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
