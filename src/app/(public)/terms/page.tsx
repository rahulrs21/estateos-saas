import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/modules/legal/legal-page";

export const metadata: Metadata = {title: "Terms of service | EstateOS", description: "The terms for using EstateOS."};

export default function TermsPage() {
  return <LegalPage title="Terms of service" intro={<p>These terms apply to companies and people who use EstateOS, operated by <ContactLine />. By using EstateOS you agree to them.</p>}>
    <section><h2>The service</h2>
      <p>EstateOS is software for real estate agencies to manage leads, contacts, properties and conversations, including WhatsApp and email channels the agency connects. Features may change as the service develops.</p></section>
    <section><h2>Accounts</h2>
      <p>Each person needs their own account and must keep their sign-in details safe. A company&apos;s owners and administrators decide who can access the company&apos;s data and with which role.</p></section>
    <section><h2>Your data and your customers</h2>
      <p>The agency remains responsible for the customer data it puts into or receives through EstateOS, for having a lawful basis to contact its customers, and for honouring opt-outs. EstateOS processes this data only to provide the service; see the <a className="underline underline-offset-2" href="/privacy">Privacy policy</a>.</p></section>
    <section><h2>Connected services</h2>
      <p>When an agency connects WhatsApp (Meta), Google or Microsoft, it must also follow those providers&apos; terms and policies, including the WhatsApp Business Messaging Policy. Messages are only sent when a person sends them, and provider charges (for example WhatsApp template messages) are the agency&apos;s.</p></section>
    <section><h2>Acceptable use</h2><ul>
      <li>No spam, unlawful, misleading or harmful messages.</li>
      <li>No attempts to access other companies&apos; data or to disrupt the service.</li>
      <li>No use that breaks the law of the country where the agency operates, including data-protection and advertising rules.</li>
    </ul></section>
    <section><h2>Availability and liability</h2>
      <p>We work to keep EstateOS available and secure but cannot promise it will be uninterrupted or error-free. To the extent the law allows, liability is limited to the fees paid for the service in the previous twelve months.</p></section>
    <section><h2>Ending use</h2>
      <p>A company can stop using EstateOS at any time and ask for its data to be deleted. We may suspend access that breaks these terms.</p></section>
    <section><h2>Contact</h2><p><ContactLine />.</p></section>
  </LegalPage>;
}
