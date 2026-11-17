import type { Metadata } from "next";
import { ContactLine, LegalPage } from "@/modules/legal/legal-page";

export const metadata: Metadata = {title: "Privacy policy | EstateOS", description: "How EstateOS handles personal data."};

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" intro={<p>EstateOS is customer-relationship software for real estate agencies. This policy explains what personal data EstateOS handles, why, and the choices people have. It is operated by <ContactLine />.</p>}>
    <section><h2>Who is responsible</h2>
      <p>Each agency that uses EstateOS decides what data it keeps about its own customers and is responsible for it (the controller). EstateOS processes that data on the agency&apos;s behalf. For the accounts of people who sign in to EstateOS, EstateOS is responsible.</p></section>
    <section><h2>What we handle</h2><ul>
      <li>Account data of agency staff: name, email address, sign-in details and the company they belong to.</li>
      <li>Customer data an agency enters or receives: contact details, enquiries, leads, viewings, notes and property interests.</li>
      <li>Messages an agency connects: WhatsApp messages and media sent to the agency&apos;s business number through the WhatsApp Business Platform (Meta), and emails from mailboxes the agency connects (Google, Microsoft), including attachments.</li>
      <li>Technical data needed to run the service securely, such as logs and rate-limit records.</li>
    </ul></section>
    <section><h2>How we use it</h2><ul>
      <li>To provide the service the agency asked for: show conversations, send the replies a person sends, and keep records of leads and properties.</li>
      <li>To keep the service secure: access checks, audit records and abuse prevention.</li>
      <li>If an agency turns it on, to prepare suggestions with an AI model (Anthropic Claude). Phone numbers and email addresses are removed from the text before it is sent, and nothing is sent to a customer or saved to a record without a person.</li>
    </ul><p>We do not sell personal data and do not use it for advertising.</p></section>
    <section><h2>WhatsApp, Google and Microsoft data</h2>
      <p>EstateOS uses the WhatsApp Business Platform only to receive and send messages for the agency that connected its number, and Google or Microsoft sign-in only to read and reply to the mailbox the agency connected. Access tokens are stored encrypted. Data received through these services is used only to provide EstateOS to that agency, never shared with other agencies, and deleted as described below.</p></section>
    <section><h2>Where data is stored and who processes it</h2>
      <p>Data is stored with Google Cloud (Firebase). Service providers that process data for EstateOS: Google (hosting, database, storage, sign-in), Meta (WhatsApp messages), Microsoft and Google (connected mailboxes, at the agency&apos;s choice) and Anthropic (AI suggestions, only when enabled). Each acts under its own terms and data-protection commitments.</p></section>
    <section><h2>How long we keep it</h2>
      <p>Each agency sets how long message content is kept (by default two years); after that, message text and files are removed. Account data is kept while the account is active. Deleted data may remain in backups for a limited period before it is overwritten.</p></section>
    <section><h2>Your choices</h2>
      <p>Customers can ask the agency they dealt with to see, correct or delete their data, or reply STOP on WhatsApp to stop messages. Anyone can also ask us directly; see <a className="underline underline-offset-2" href="/data-deletion">Data deletion</a>.</p></section>
    <section><h2>Security</h2>
      <p>Access is limited by company and role, sign-in is verified on the server for every request, access tokens are encrypted, and sensitive actions are recorded in an audit log.</p></section>
    <section><h2>Contact</h2><p>Questions about this policy: <ContactLine />.</p></section>
  </LegalPage>;
}
