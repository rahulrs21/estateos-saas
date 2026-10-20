import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/modules/dashboard/components/dashboard";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

async function AuthenticatedDashboard() {
  const { activeCompany } = await requireCompanyWorkspace();
  return <Dashboard companyName={activeCompany.name} />;
}

export default function DashboardPage() {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedDashboard />
  </Suspense>;
}
