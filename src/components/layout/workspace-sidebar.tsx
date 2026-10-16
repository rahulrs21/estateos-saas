"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Building2, PanelLeftClose, X } from "lucide-react";
import { navigationGroups } from "@/config/navigation";
import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const { state, isMobile, setOpenMobile, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="h-[76px] justify-center px-4 group-data-[collapsible=icon]:px-2">
        <div className="flex items-center justify-between gap-1">
          <Link href="/" aria-label="EstateOS homepage" className="rounded-lg"><Brand compact={collapsed} /></Link>
          {!collapsed && <Button variant="ghost" size="icon-sm" onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar} aria-label={isMobile ? "Close navigation" : "Collapse sidebar"} className="text-muted-foreground">
            {isMobile ? <X aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
          </Button>}
        </div>
      </SidebarHeader>
      <div className="mx-4 mb-3 flex items-center gap-2.5 rounded-xl border bg-background p-2.5 group-data-[collapsible=icon]:mx-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1.5">
        <Building2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 group-data-[collapsible=icon]:hidden">
          <p className="truncate text-xs font-semibold text-foreground">Workspace preview</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">No agency connected</p>
        </div>
      </div>
      <SidebarContent className="px-2 pb-3 group-data-[collapsible=icon]:overflow-y-auto">
        <nav aria-label="Workspace navigation">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              <SidebarGroupLabel className="h-7 text-[10px] font-semibold tracking-[0.12em] uppercase">{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton render={<Link href={item.href} />} isActive={pathname === item.href} aria-current={pathname === item.href ? "page" : undefined} aria-label={item.title} tooltip={item.title} onClick={() => setOpenMobile(false)} className="h-9 gap-3 rounded-lg text-[13px]">
                        <item.icon aria-hidden="true" /><span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t px-4 py-3 group-data-[collapsible=icon]:px-2">
        <Link href="/" className="flex min-h-9 items-center gap-2 rounded-lg text-xs text-muted-foreground hover:text-primary" aria-label="Back to EstateOS homepage" title="Back to homepage">
          <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" /><span className="group-data-[collapsible=icon]:hidden">Back to EstateOS</span>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
