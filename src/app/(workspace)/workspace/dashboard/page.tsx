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
  const [user, workspace, params] = await Promise.all([requireSession(), requireCompanyWorkspace(), searchParams]);
  const companyWide = workspace.activeCompany.role === "OWNER" || workspace.activeCompany.role === "ADMIN";
  return <Dashboard firstName={firstName(user.name)} range={parseDashboardRange(params.range)} scopeLabel={companyWide ? "All company leads" : "Leads assigned to you"} />;
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedDashboard searchParams={searchParams} />
  </Suspense>;
}
