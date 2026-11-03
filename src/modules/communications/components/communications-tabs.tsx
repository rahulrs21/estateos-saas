import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  {key: "overview", label: "Overview", href: "/communications"},
  {key: "calls", label: "Calls", href: "/communications/calls"},
  {key: "settings", label: "Settings", href: "/communications/settings"},
] as const;

/** Section navigation for the communication hub. Settings are read-only for managers and agents. */
export function CommunicationsTabs({current, role}: {current: (typeof TABS)[number]["key"]; role: "OWNER" | "ADMIN" | "MANAGER" | "AGENT"}) {
  return <nav aria-label="Communications sections" className="flex flex-wrap gap-1 border-b">
    {TABS.map(tab => <Link key={tab.key} href={tab.href} aria-current={tab.key === current ? "page" : undefined}
      className={cn("-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors", tab.key === current ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
      {tab.key === "settings" && role !== "OWNER" && role !== "ADMIN" ? "Calling rules" : tab.label}
    </Link>)}
  </nav>;
}
