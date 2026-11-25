import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/modules/dashboard/components/dashboard";
import { parseDashboardRange } from "@/modules/dashboard/dashboard-model";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AuthenticatedDashboard({ searchParams }: { searchParams: SearchParams }) {
  const [{ activeCompany }, params] = await Promise.all([requireCompanyWorkspace(), searchParams]);
  return <Dashboard companyName={activeCompany.name} range={parseDashboardRange(params.range)} />;
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedDashboard searchParams={searchParams} />
  </Suspense>;
}
