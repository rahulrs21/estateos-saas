import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { LeadAnalyticsDashboard } from "@/modules/lead-capture/components/lead-analytics-dashboard";
import { getLeadAnalytics } from "@/modules/lead-capture/server/reports";

export const metadata: Metadata = { title: "Lead analytics" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function LeadAnalyticsContent({ searchParams }: { searchParams?: SearchParams }) {
  const supplied = searchParams ? await searchParams : {};
  const filters = Object.fromEntries(Object.entries(supplied).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const data = await getLeadAnalytics(filters);
  return <div className="space-y-6">
    <PageHeader eyebrow="Company analytics" title="Lead reports" description="Understand real lead volume, assignment and conversion for your authorized workspace records." />
    <LeadAnalyticsDashboard data={data} />
  </div>;
}

export default function ReportsPage({ searchParams }: { searchParams?: SearchParams }) {
  return <Suspense fallback={<PageSkeleton />}><LeadAnalyticsContent searchParams={searchParams} /></Suspense>;
}
