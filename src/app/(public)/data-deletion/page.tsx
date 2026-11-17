import type { Metadata } from "next";
import { ContactLine, LegalPage, legalOperator } from "@/modules/legal/legal-page";

export const metadata: Metadata = {title: "Data deletion", description: "How to have your data deleted from EstateOS."};

export default function DataDeletionPage() {
  const {email} = legalOperator();
  return <LegalPage title="Data deletion instructions" intro={<p>You can ask for personal data held in EstateOS to be deleted at any time. This page explains how.</p>}>
    <section><h2>If you are a customer of an agency</h2>
      <p>Your details are held by the agency you contacted. Ask that agency to delete them; they can remove your contact, leads and conversations in EstateOS. To stop WhatsApp messages at once, reply <strong>STOP</strong> in the chat.</p></section>
    <section><h2>If you use EstateOS (agency staff)</h2>
      <p>Your company&apos;s owner or administrator can remove your access. To have your account deleted, or a whole company&apos;s data, write to us as described below.</p></section>
    <section><h2>Disconnecting WhatsApp, Google or Microsoft</h2>
      <p>An owner or administrator can disconnect a mailbox in Inbox settings, and EstateOS deletes its stored sign-in, or disable a WhatsApp channel so it stops sending and receiving. To have a channel&apos;s stored access token deleted as well, ask us as described below. You can also remove EstateOS&apos;s access in your Meta, Google or Microsoft account settings.</p></section>
    <section><h2>Ask us directly</h2>
      <p>Send a request {email ? <>to <a className="underline underline-offset-2" href={`mailto:${email}?subject=Data%20deletion%20request`}>{email}</a></> : <>to <ContactLine /></>} with the subject &quot;Data deletion request&quot;, the email address or phone number concerned and, if you know it, the agency&apos;s name. We confirm the request, delete the data within 30 days (backups are overwritten within a limited period) and tell you when it is done.</p></section>
  </LegalPage>;
}
