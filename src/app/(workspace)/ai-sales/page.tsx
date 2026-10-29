import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { SalesDashboard } from "@/modules/ai/sales/components/sales-dashboard";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "AI Sales" };

/** The page resolves only the verified company; every metric request is authorized again on the server. */
async function AuthenticatedSales() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <div className="space-y-5">
    <PageHeader eyebrow="Intelligence" title="AI Sales" description="Recorded pipeline metrics for the leads you can access, rule-based lead priorities and optional Claude summaries. Nothing here changes records or contacts customers." />
    <SalesDashboard organizationId={activeCompany.id} />
  </div>;
}

export default function AiSalesPage() {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedSales />
  </Suspense>;
}
