import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Change } from "../dashboard-model";
import { AnimatedNumber } from "./motion";

export type Tone = "teal" | "green" | "amber" | "blue" | "violet" | "rose";

/** Tinted icon tile backgrounds and foregrounds (globals.css tokens, separate values in dark mode). */
export const toneClass: Record<Tone, string> = {
  teal: "bg-(--tile-teal) text-(--tile-teal-fg)",
  green: "bg-(--tile-green) text-(--tile-green-fg)",
  amber: "bg-(--tile-amber) text-(--tile-amber-fg)",
  blue: "bg-(--tile-blue) text-(--tile-blue-fg)",
  violet: "bg-(--tile-violet) text-(--tile-violet-fg)",
  rose: "bg-(--tile-rose) text-(--tile-rose-fg)",
};

export function IconTile({icon: Icon, tone, size = "md"}: {icon: LucideIcon; tone: Tone; size?: "sm" | "md"}) {
  return <span className={cn("flex shrink-0 items-center justify-center rounded-xl", size === "md" ? "size-11" : "size-9 rounded-lg", toneClass[tone])} aria-hidden="true">
    <Icon className={size === "md" ? "size-5" : "size-4"} />
  </span>;
}

/** "↑ 12% vs previous 30 days", in text so the direction never depends on colour alone. */
export function ChangeBadge({change, period}: {change: Change; period: string}) {
  if (!change) return <span className="text-muted-foreground">No change vs previous {period}</span>;
  if (change.direction === "new") return <span className="font-medium text-(--tile-green-fg)">New this period</span>;
  const Icon = change.direction === "up" ? ArrowUpRight : change.direction === "down" ? ArrowDownRight : ArrowRight;
  return <span className="inline-flex items-center gap-1">
    <span className={cn("inline-flex items-center gap-0.5 font-medium", change.direction === "up" ? "text-(--tile-green-fg)" : change.direction === "down" ? "text-(--tile-rose-fg)" : "text-muted-foreground")}>
      <Icon className="size-3.5" aria-hidden="true" />{change.percent}%<span className="sr-only">{change.direction === "up" ? " up" : change.direction === "down" ? " down" : " unchanged"}</span>
    </span>
    <span className="text-muted-foreground">vs previous {period}</span>
  </span>;
}

/**
 * A headline figure: icon tile, label, value and one line of context, with an
 * optional small chart on the right. `value` null means it could not be
 * loaded; the tile says so instead of showing 0.
 */
export function KpiCard({title, value, icon, tone, detail, trailing, meter, href}: {
  title: string; value: number | null; icon: LucideIcon; tone: Tone; detail: ReactNode;
  /** A small chart beside the value (e.g. a sparkline). */
  trailing?: ReactNode;
  /** A full-width proportion bar under the detail line. */
  meter?: ReactNode;
  href?: string;
}) {
  const body = <CardContent className="flex h-full flex-col gap-3 px-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <IconTile icon={icon} tone={tone} />
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-medium text-muted-foreground">{title}</h3>
          {value === null
            ? <p className="text-2xl leading-tight font-semibold text-muted-foreground" aria-label={`${title}: unavailable`}><span aria-hidden="true">—</span></p>
            : <p className="text-2xl leading-tight font-semibold tracking-tight tabular-nums"><AnimatedNumber value={value} /></p>}
        </div>
      </div>
      {trailing && <div className="shrink-0 pt-1">{trailing}</div>}
    </div>
    <div className="mt-auto space-y-2">
      <div className="text-xs leading-5">{detail}</div>
      {meter}
    </div>
  </CardContent>;
  return <Card className={cn("h-full py-4 shadow-xs", href && "transition-colors hover:bg-muted/30")}>
    {href ? <Link href={href} className="h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">{body}</Link> : body}
  </Card>;
}

/** A labelled proportion, e.g. lead-to-won rate: a thin full-width bar with its value in text beside it. */
export function RatioBar({percent, label, tone = "teal"}: {percent: number; label: string; tone?: Tone}) {
  const width = `${Math.max(0, Math.min(100, percent))}%`;
  return <div className="flex items-center gap-2.5">
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
      <div className={cn("h-full rounded-full", tone === "amber" ? "bg-(--tile-amber-fg)" : tone === "rose" ? "bg-(--tile-rose-fg)" : "bg-chart-1")} style={{width}} />
    </div>
    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{label}</span>
  </div>;
}
