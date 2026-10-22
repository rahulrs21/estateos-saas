import Link from "next/link";
import { ArrowLeft, Mail, Phone, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactEditorDialog } from "./contact-editor-dialog";
import type { ContactRecord } from "../types";

export function ContactDetail({ organization, role, contact }: { organization: { id: string; name: string }; role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT"; contact: ContactRecord }) {
  const canManage = role === "OWNER" || role === "ADMIN";
  const details = [
    ["Email", contact.email, Mail],
    ["Phone", contact.phone, Phone],
    ["Alternate phone", contact.alternatePhone, Phone],
    ["Nationality", contact.nationality, UserRound],
    ["Preferred language", contact.preferredLanguage, UserRound],
  ] as const;
  return <div className="mx-auto max-w-5xl space-y-6">
    <Link href="/contacts" className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" aria-hidden="true" />Back to contacts</Link>
    <PageHeader title={contact.fullName} eyebrow={organization.name} description="Contact profile and notes within this company workspace.">
      {canManage && <ContactEditorDialog organization={organization} contact={contact} />}
    </PageHeader>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
      <Card className="shadow-xs"><CardHeader><CardTitle className="text-base">Contact information</CardTitle><CardDescription>Only members with permission can view this company record.</CardDescription></CardHeader><CardContent><dl className="grid gap-5 sm:grid-cols-2">{details.map(([label, value, Icon]) => <div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 flex min-w-0 items-center gap-2 text-sm font-medium">{value ? <><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{label === "Email" ? <a className="truncate hover:text-primary" href={`mailto:${value}`}>{value}</a> : label.toLowerCase().includes("phone") ? <a className="truncate hover:text-primary" href={`tel:${value}`}>{value}</a> : <span className="truncate">{value}</span>}</> : <span className="text-muted-foreground">Not provided</span>}</dd></div>)}</dl></CardContent></Card>
      <Card className="shadow-xs"><CardHeader><CardTitle className="text-base">Notes</CardTitle><CardDescription>Internal context for this contact.</CardDescription></CardHeader><CardContent><p className="min-h-24 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{contact.notes || "No notes have been added."}</p><p className="mt-4 border-t pt-4 text-xs text-muted-foreground">Updated {new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }).format(new Date(contact.updatedAt))}</p></CardContent></Card>
    </div>
    {!canManage && <p className="text-xs text-muted-foreground">Contact changes are limited to company owners and administrators.</p>}
    <Link href="/leads" className={buttonVariants({ variant: "ghost", size: "sm" })}>Open leads</Link>
  </div>;
}
