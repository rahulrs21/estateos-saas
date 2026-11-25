import Link from "next/link";
import { cn } from "@/lib/utils";
import { DASHBOARD_TIME_ZONE, type AgendaDue, type AgendaItem } from "../dashboard-model";
import { SectionEmpty } from "./dashboard-card";

const dueTime = new Intl.DateTimeFormat("en-AE", {hour: "numeric", minute: "2-digit", timeZone: DASHBOARD_TIME_ZONE});
const dueDay = new Intl.DateTimeFormat("en-AE", {weekday: "short", day: "numeric", month: "short", timeZone: DASHBOARD_TIME_ZONE});

function dueLabel(item: AgendaItem) {
  const date = new Date(item.dueAt);
  if (item.due === "TODAY") return `Today, ${dueTime.format(date)}`;
  return dueDay.format(date);
}

const dueStyle: Record<AgendaDue, string> = {
  OVERDUE: "text-destructive",
  TODAY: "text-foreground",
  THIS_WEEK: "text-muted-foreground",
  LATER: "text-muted-foreground",
};

/** The next open follow-ups and work tasks, soonest first. Overdue items say so in text, not colour alone. */
export function TaskAgenda({items, limit = 6}: {items: AgendaItem[]; limit?: number}) {
  if (!items.length) return <SectionEmpty>No open follow-ups or tasks.</SectionEmpty>;
  return <ul className="-mx-2 divide-y">
    {items.slice(0, limit).map(item => {
      const content = <>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{item.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.kind === "FOLLOW_UP" ? "Follow-up" : "Task"} · {item.context}</span>
        </span>
        <span className={cn("shrink-0 text-right text-xs tabular-nums", dueStyle[item.due])}>
          {item.due === "OVERDUE" && <span className="block font-medium">Overdue</span>}
          <time dateTime={item.dueAt}>{dueLabel(item)}</time>
        </span>
      </>;
      return <li key={item.id}>
        {item.href
          ? <Link href={item.href} className="flex items-center gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">{content}</Link>
          : <div className="flex items-center gap-4 px-2 py-2.5">{content}</div>}
      </li>;
    })}
  </ul>;
}
