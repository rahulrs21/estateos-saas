import Link from "next/link";
import { CalendarCheck2, FileText, Home, type LucideIcon, Sparkles, TrendingUp, UserPlus } from "lucide-react";
import { relativeTime, type ActivityTone } from "../dashboard-model";
import { IconTile, type Tone } from "./kpi-card";
import { SectionEmpty } from "./dashboard-card";

export type ActivityRow = {id: string; title: string; tone: ActivityTone; leadId: string; leadName: string; actor: string; createdAt: string};

const ICONS: Record<ActivityTone, {icon: LucideIcon; tone: Tone}> = {
  lead: {icon: UserPlus, tone: "teal"},
  stage: {icon: TrendingUp, tone: "amber"},
  note: {icon: FileText, tone: "blue"},
  task: {icon: CalendarCheck2, tone: "green"},
  property: {icon: Home, tone: "violet"},
  other: {icon: Sparkles, tone: "teal"},
};

/** Latest activity on the leads the member can see, newest first; each row opens the lead. */
export function ActivityFeed({rows, now}: {rows: ActivityRow[]; now: string}) {
  if (!rows.length) return <SectionEmpty>No lead activity yet.</SectionEmpty>;
  const at = new Date(now);
  return <ul className="-mx-2">
    {rows.map(row => {
      const {icon, tone} = ICONS[row.tone];
      return <li key={row.id}>
        <Link href={`/leads/${row.leadId}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <IconTile icon={icon} tone={tone} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{row.title}</span>
            <span className="block truncate text-xs text-muted-foreground">{row.leadName} · by {row.actor}</span>
          </span>
          <time dateTime={row.createdAt} className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{relativeTime(row.createdAt, at)}</time>
        </Link>
      </li>;
    })}
  </ul>;
}
