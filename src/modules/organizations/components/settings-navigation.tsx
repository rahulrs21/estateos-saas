"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SettingsNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Company settings" className="mb-6 flex flex-wrap gap-2 border-b pb-4">
    {[["/workspace/dashboard", "Dashboard"], ["/settings/company", "Company"], ["/settings/team", "Team members"], ["/settings/team/invitations", "Invitations"], ["/settings/lead-distribution", "Lead distribution"], ["/settings/lead-forms", "Website lead forms"]].map(([href, label]) =>
      <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted", pathname === href ? "bg-secondary text-primary" : "text-muted-foreground")}>{label}</Link>)}
  </nav>;
}
