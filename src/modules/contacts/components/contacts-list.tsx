"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ContactRound, Mail, Phone, Search, UserRound } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactEditorDialog } from "./contact-editor-dialog";
import type { ContactRecord, ContactsPageData } from "../types";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" }).format(date)
    : "Date unavailable";
}

function ContactRow({ contact }: { contact: ContactRecord }) {
  return <tr className="border-b last:border-0 hover:bg-muted/20">
    <td className="px-4 py-3 sm:px-5"><div className="flex min-w-44 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/5 text-primary"><UserRound className="size-4" aria-hidden="true" /></span><Link href={`/contacts/${encodeURIComponent(contact.id)}`} className="truncate font-medium underline-offset-4 hover:text-primary hover:underline">{contact.fullName}</Link></div></td>
    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-5">{contact.email ? <a className="inline-flex items-center gap-2 hover:text-foreground" href={`mailto:${contact.email}`}><Mail className="size-3.5" aria-hidden="true" />{contact.email}</a> : <span className="text-xs">No email</span>}</td>
    <td className="px-4 py-3 text-sm text-muted-foreground sm:px-5">{contact.phone ? <a className="inline-flex items-center gap-2 hover:text-foreground" href={`tel:${contact.phone}`}><Phone className="size-3.5" aria-hidden="true" />{contact.phone}</a> : <span className="text-xs">No phone</span>}</td>
    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground sm:px-5">{formatDate(contact.updatedAt)}</td>
    <td className="px-4 py-3 text-right sm:px-5"><Link href={`/contacts/${encodeURIComponent(contact.id)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View</Link></td>
  </tr>;
}

export function ContactsList({ data }: { data: ContactsPageData }) {
  const canManage = data.role === "OWNER" || data.role === "ADMIN";
  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));
  const pageHref = (page: number) => {
    const query = new URLSearchParams();
    if (data.search) query.set("search", data.search);
    query.set("page", String(page));
    return `/contacts?${query.toString()}`;
  };
  return <div className="space-y-6">
    <PageHeader title="Contacts" eyebrow={data.organization.name} description="A company-wide directory for the people behind your opportunities.">
      {canManage && <ContactEditorDialog organization={data.organization} />}
    </PageHeader>
    <Card className="gap-0 overflow-hidden py-0 shadow-xs">
      <form action="/contacts" method="get" className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end sm:p-5" aria-label="Search contacts">
        <div className="min-w-0 flex-1 space-y-2"><Label htmlFor="contact-search" className="text-xs">Search contacts</Label><div className="relative"><Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" aria-hidden="true" /><Input id="contact-search" type="search" name="search" maxLength={120} defaultValue={data.search} placeholder="Name, email or phone" className="h-10 pl-9" /></div></div>
        <Button type="submit" variant="outline" className="h-10"><Search aria-hidden="true" />Search</Button>
      </form>
      {data.contacts.length === 0 ? <EmptyState icon={ContactRound} title={data.search ? "No contacts match this search" : "No contacts yet"} description={data.search ? "Try another name, email address or phone number." : "Add a contact to keep customer information organized in this company workspace."} className="min-h-72">
        {data.search ? <Link href="/contacts" className={buttonVariants({ variant: "outline" })}>Clear search</Link> : canManage ? <ContactEditorDialog organization={data.organization} /> : null}
      </EmptyState> : <>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium sm:px-5">Name</th><th scope="col" className="px-4 py-3 font-medium sm:px-5">Email</th><th scope="col" className="px-4 py-3 font-medium sm:px-5">Phone</th><th scope="col" className="px-4 py-3 font-medium sm:px-5">Updated</th><th scope="col" className="px-4 py-3 text-right font-medium sm:px-5">Details</th></tr></thead><tbody>{data.contacts.map(contact => <ContactRow key={contact.id} contact={contact} />)}</tbody></table></div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground sm:px-5"><span>{data.total.toLocaleString("en-GB")} {data.total === 1 ? "contact" : "contacts"} · Page {data.page} of {pageCount}</span><div className="flex items-center gap-2">{data.page > 1 ? <Link href={pageHref(data.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}><ArrowLeft aria-hidden="true" />Previous</Link> : <Button variant="outline" size="sm" disabled><ArrowLeft aria-hidden="true" />Previous</Button>}{data.hasNext ? <Link href={pageHref(data.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>Next<ArrowRight aria-hidden="true" /></Link> : <Button variant="outline" size="sm" disabled>Next<ArrowRight aria-hidden="true" /></Button>}</div></div>
      </>}
    </Card>
  </div>;
}
