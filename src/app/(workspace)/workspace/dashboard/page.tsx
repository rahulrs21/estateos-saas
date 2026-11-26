import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/modules/dashboard/components/dashboard";
import { firstName, parseDashboardRange } from "@/modules/dashboard/dashboard-model";
import { requireSession } from "@/lib/auth/session";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function AuthenticatedDashboard({ searchParams }: { searchParams: SearchParams }) {
  const [user, , params] = await Promise.all([requireSession(), requireCompanyWorkspace(), searchParams]);
  return <Dashboard firstName={firstName(user.name)} range={parseDashboardRange(params.range)} />;
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedDashboard searchParams={searchParams} />
  </Suspense>;
}
