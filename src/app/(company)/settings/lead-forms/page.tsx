import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { LeadFormManager } from "@/modules/lead-capture/components/lead-form-manager";
import { listLeadCaptureForms } from "@/modules/lead-capture/server/service";

export const metadata: Metadata = { title: "Website lead forms" };

async function LeadFormsContent() {
  const data = await listLeadCaptureForms();
  return <div className="space-y-6">
    <PageHeader eyebrow="Company settings" title="Website lead forms" description="Publish secure inquiry forms and route submissions into your active company workspace." />
    <LeadFormManager data={data} />
  </div>;
}

export default function LeadFormsPage() {
  return <Suspense fallback={<PageSkeleton />}><LeadFormsContent /></Suspense>;
}
