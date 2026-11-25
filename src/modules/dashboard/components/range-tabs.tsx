import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_RANGES, type DashboardRange } from "../dashboard-model";

/** Reporting period switch. Plain links, so it works before hydration and keeps the period in the URL. */
export function RangeTabs({active}: {active: DashboardRange}) {
  return <nav aria-label="Reporting period" className="inline-flex rounded-lg border bg-card p-0.5 shadow-xs">
    {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map(range => <Link key={range} href={`/workspace/dashboard?range=${range}`} scroll={false}
      aria-current={range === active ? "page" : undefined}
      className={cn("rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        range === active && "bg-secondary text-foreground")}>
      {DASHBOARD_RANGES[range].label}
    </Link>)}
  </nav>;
}
