import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_RANGES, type DashboardRange } from "../dashboard-model";

const SHORT: Record<DashboardRange, string> = {"7d": "7D", "30d": "30D", "90d": "90D", "1y": "1Y"};

/** Reporting period pills. Plain links, so they work before hydration and keep the period in the URL. */
export function RangeTabs({active}: {active: DashboardRange}) {
  return <nav aria-label="Reporting period" className="flex items-center gap-1">
    {(Object.keys(DASHBOARD_RANGES) as DashboardRange[]).map(range => <Link key={range} href={`/workspace/dashboard?range=${range}`} scroll={false}
      aria-current={range === active ? "page" : undefined} aria-label={`Last ${DASHBOARD_RANGES[range].label}`}
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        range === active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground")}>
      {SHORT[range]}
    </Link>)}
  </nav>;
}
