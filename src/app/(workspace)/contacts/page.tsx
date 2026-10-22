import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { requireSession } from "@/lib/auth/session";
import { ContactsAccessState } from "@/modules/contacts/components/contacts-access-state";
import { ContactsList } from "@/modules/contacts/components/contacts-list";
import { getContactsPageData } from "@/modules/contacts/server/views";
import type { ContactsPageData } from "@/modules/contacts/types";
import { WorkspaceError } from "@/modules/organizations/server/errors";

export const metadata: Metadata = { title: "Contacts" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function ContactsContent({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  let data: ContactsPageData;
  try {
    data = await getContactsPageData(await searchParams);
  } catch (error) {
    if (error instanceof WorkspaceError) return <ContactsAccessState error={error} />;
    throw error;
  }
  return <ContactsList data={data} />;
}

export default function ContactsPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><ContactsContent searchParams={searchParams} /></Suspense>;
}
