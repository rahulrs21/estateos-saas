"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Check, ChevronsUpDown, LoaderCircle, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { companyRequest } from "../client";
import type { CompanyChoice } from "../types";

const ROLE_LABELS: Record<string, string> = {OWNER: "Owner", ADMIN: "Administrator", MANAGER: "Manager", AGENT: "Agent"};

/**
 * The sidebar's company card: the active company and the member's role, with
 * a menu to switch to another company (the same /api/organizations/switch the
 * full workspace selector uses, then a fresh load of the dashboard so no
 * previous-company state survives) or open company settings.
 */
export function CompanySwitcherMenu({companies, activeId}: {companies: CompanyChoice[]; activeId?: string}) {
  const [pending, setPending] = useState<string | null>(null);
  const active = companies.find(company => company.id === activeId) ?? null;

  async function switchTo(company: CompanyChoice) {
    if (pending || company.id === activeId) return;
    setPending(company.id);
    try {
      await companyRequest("/api/organizations/switch", "POST", {organizationId: company.id});
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard all previous-company router and form state.
      window.location.assign("/workspace/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change workspace. Please try again.");
      setPending(null);
    }
  }

  return <DropdownMenu>
    <DropdownMenuTrigger render={<button type="button" aria-label={`Company workspace: ${active?.name ?? "none selected"}. Switch company`} title={active?.name}
      className="flex w-full items-center gap-2.5 rounded-xl border bg-background p-2 text-left shadow-xs transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-lg group-data-[collapsible=icon]:p-0" />}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--tile-teal) text-(--tile-teal-fg) group-data-[collapsible=icon]:size-8" aria-hidden="true">
        {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Building2 className="size-[18px]" />}
      </span>
      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <span className="block truncate text-[13px] leading-5 font-semibold">{active?.name ?? "Select a company"}</span>
        <span className="block truncate text-[11px] leading-4 text-muted-foreground">{active ? `${ROLE_LABELS[active.role] ?? active.role} · Workspace` : "No active workspace"}</span>
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-64">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Companies</DropdownMenuLabel>
        {companies.map(company => <DropdownMenuItem key={company.id} disabled={pending !== null} onClick={() => void switchTo(company)}>
          <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold", company.id === activeId ? "bg-(--tile-teal) text-(--tile-teal-fg)" : "bg-muted text-muted-foreground")} aria-hidden="true">
            {company.name.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{company.name}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[company.role] ?? company.role}</span>
          </span>
          {pending === company.id ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : company.id === activeId && <Check className="size-3.5 text-primary" aria-label="Current company" />}
        </DropdownMenuItem>)}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link href="/settings/company" />}><Settings2 aria-hidden="true" />Company settings</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}
