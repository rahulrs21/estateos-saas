import Link from "next/link";
import { BarChart3, CalendarCheck2, House, UserPlus, type LucideIcon } from "lucide-react";
import { IconTile, type Tone } from "./kpi-card";

type Shortcut = {href: string; label: string; icon: LucideIcon; tone: Tone};

/**
 * Links to existing pages. "Add property" is offered only to owners and
 * administrators, who are the roles allowed to create inventory.
 */
export function QuickShortcuts({canManageInventory}: {canManageInventory: boolean}) {
  const items: Shortcut[] = [
    {href: "/leads/new", label: "Add lead", icon: UserPlus, tone: "teal"},
    ...(canManageInventory ? [{href: "/properties/new", label: "Add property", icon: House, tone: "violet" as const}] : []),
    {href: "/workspace/tasks", label: "My tasks", icon: CalendarCheck2, tone: "green"},
    {href: "/workspace/reports", label: "Reports", icon: BarChart3, tone: "blue"},
  ];
  return <ul className="grid grid-cols-2 gap-2">
    {items.map(({href, label, icon, tone}) => <li key={href}>
      <Link href={href} className="flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center text-xs font-medium transition-colors hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <IconTile icon={icon} tone={tone} size="sm" />{label}
      </Link>
    </li>)}
  </ul>;
}
