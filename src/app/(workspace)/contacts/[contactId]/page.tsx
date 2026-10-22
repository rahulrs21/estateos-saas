import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { ContactDetail } from "@/modules/contacts/components/contact-detail";
import { ContactsAccessState } from "@/modules/contacts/components/contacts-access-state";
import { getContactPageData } from "@/modules/contacts/server/views";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Contact details" };
type Params = Promise<{ contactId: string }>;

async function ContactContent({ params }: { params: Params }) {
  await requireSession();
  let data: Awaited<ReturnType<typeof getContactPageData>>;
  try {
    const { contactId } = await params;
    data = await getContactPageData(contactId);
  } catch (error) {
    if (error instanceof WorkspaceError) return <ContactsAccessState error={error} detail />;
    throw error;
  }
  return <ContactDetail {...data} />;
}

export default function ContactPage({ params }: { params: Params }) {
  return <Suspense fallback={<PageSkeleton />}><ContactContent params={params} /></Suspense>;
}
