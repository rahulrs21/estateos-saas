import type { ReactNode } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./motion";

/**
 * A headline figure: label, value and one line of context. `value` null means
 * the figure could not be loaded; the tile then says so instead of showing 0.
 */
export function KpiCard({title, value, suffix, detail, trailing, href}: {
  title: string; value: number | null; suffix?: string; detail: ReactNode; trailing?: ReactNode; href?: string;
}) {
  const body = <CardContent className="flex h-full flex-col px-5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>
    </div>
    <div className="mt-2 flex items-end justify-between gap-3">
      {value === null
        ? <p className="text-[28px] leading-none font-semibold text-muted-foreground" aria-label={`${title}: unavailable`}><span aria-hidden="true">—</span></p>
        : <p className="flex items-baseline gap-1 text-[28px] leading-none font-semibold tracking-tight tabular-nums"><AnimatedNumber value={value} />{suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}</p>}
      {trailing}
    </div>
    <div className="mt-3 text-xs leading-5 text-muted-foreground">{detail}</div>
  </CardContent>;
  return <Card className={cn("h-full shadow-xs", href && "transition-colors hover:bg-muted/30")}>
    {href ? <Link href={href} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link> : body}
  </Card>;
}
