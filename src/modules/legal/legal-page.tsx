import Link from "next/link";
import type { ReactNode } from "react";

/*
 * Public legal pages (privacy, terms, data deletion), linked from Meta's app settings and the site footer. The
 * operator's name and public contact address come from each environment's settings (ESTATEOS_LEGAL_ENTITY,
 * ESTATEOS_LEGAL_CONTACT_EMAIL in apphosting.<environment>.yaml); the pages are built ahead of time, so the values
 * are needed at build time. The wording is a starting point to be reviewed by the operator's legal adviser.
 */

export const LAST_UPDATED = "20 November 2026";

export function legalOperator() {
  const entity = process.env.ESTATEOS_LEGAL_ENTITY?.trim() || "the company that operates EstateOS";
  const email = process.env.ESTATEOS_LEGAL_CONTACT_EMAIL?.trim() || null;
  return {entity, email};
}

export function ContactLine() {
  const {entity, email} = legalOperator();
  return <>{entity}{email ? <>, at <a className="underline underline-offset-2" href={`mailto:${email}`}>{email}</a></> : " through the contact details on its website"}</>;
}

export function LegalPage({title, intro, children}: {title: string; intro: ReactNode; children: ReactNode}) {
  return <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-16">
    <p className="text-sm font-medium text-muted-foreground"><Link href="/" className="hover:underline">EstateOS</Link></p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
    <p className="mt-2 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
    <div className="mt-6 text-base leading-7 text-muted-foreground">{intro}</div>
    <div className="mt-8 space-y-8 text-[15px] leading-7 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    <nav aria-label="Legal" className="mt-12 flex flex-wrap gap-4 border-t pt-6 text-sm text-muted-foreground">
      <Link href="/privacy" className="hover:underline">Privacy policy</Link>
      <Link href="/terms" className="hover:underline">Terms of service</Link>
      <Link href="/data-deletion" className="hover:underline">Data deletion</Link>
    </nav>
  </main>;
}
