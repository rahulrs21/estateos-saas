import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/modules/dashboard/components/dashboard";
import { requireSession } from "@/lib/auth/session";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export const metadata: Metadata = { title: "Dashboard" };

async function AuthenticatedDashboard() {
  await requireSession();
  return <Dashboard />;
}

export default function DashboardPage() {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedDashboard />
  </Suspense>;
}
