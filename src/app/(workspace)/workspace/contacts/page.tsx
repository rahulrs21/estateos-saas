import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Contacts" };

export default function ContactsPage() {
  return <Suspense fallback={<PageSkeleton />}>
    <ModulePreview slug="contacts" />
  </Suspense>;
}
