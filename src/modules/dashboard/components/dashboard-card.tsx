import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedBar } from "./motion";

/** The standard dashboard panel: a titled card with an optional action link and a muted description. */
export function DashboardCard({title, description, action, children, className, contentClassName}: {
  title: string; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; contentClassName?: string;
}) {
  return <Card className={cn("h-full gap-4 shadow-xs", className)}>
    <CardHeader className="px-5">
      <CardTitle role="heading" aria-level={2} className="text-[15px] font-semibold">{title}</CardTitle>
      {description && <CardDescription className="text-xs">{description}</CardDescription>}
      {action && <CardAction className="text-xs">{action}</CardAction>}
    </CardHeader>
    <CardContent className={cn("flex-1 px-5", contentClassName)}>{children}</CardContent>
  </Card>;
}

/** A section that failed to load; the rest of the dashboard is unaffected. */
export function SectionError({message}: {message: string}) {
  return <div role="alert" className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
    <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
    <p>{message} Reload the page to try again.</p>
  </div>;
}

/** Plain empty state for a panel with no rows in the selected period. */
export function SectionEmpty({children}: {children: ReactNode}) {
  return <p className="flex min-h-24 items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

const integer = new Intl.NumberFormat("en-AE", {maximumFractionDigits: 0});

/**
 * Rows ranked by count, each with a thin bar scaled to the largest row and its
 * share of `total`. Labels and values are text; the bars are decorative.
 */
export function RankedList({rows, total, unit}: {rows: ReadonlyArray<{label: string; count: number}>; total: number; unit: string}) {
  const max = rows.reduce((best, row) => Math.max(best, row.count), 0);
  return <ul className="space-y-3.5">
    {rows.map((row, index) => <li key={`${index}-${row.label}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate" title={row.label}>{row.label}</span>
        <span className="shrink-0 tabular-nums">
          <span className="font-medium">{integer.format(row.count)}</span>
          {total > 0 && <span className="ml-2 inline-block w-11 text-right text-xs text-muted-foreground">{Math.round(row.count / total * 100)}%</span>}
          <span className="sr-only"> {unit}</span>
        </span>
      </div>
      <AnimatedBar percent={max ? row.count / max * 100 : 0} index={index} />
    </li>)}
  </ul>;
}
