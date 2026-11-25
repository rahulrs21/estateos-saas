"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Clock3, LoaderCircle, LogOut, Monitor, Moon, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { logout } from "@/modules/auth/client";
import { leadRequest } from "@/modules/leads/client";
import type { CompanyChoice } from "@/modules/organizations/types";
import { clockDate, clockTime, useLiveClock } from "./use-live-clock";

const ROLE_LABELS: Record<string, string> = {OWNER: "Owner", ADMIN: "Administrator", MANAGER: "Manager", AGENT: "Agent"};
const AVAILABILITY_PATH = "/api/lead-distribution/availability";
/** How often an agent's availability is re-read (an administrator may change it, or an "away until" time may pass). */
const AVAILABILITY_REFRESH_MS = 60_000;

type Availability = "AVAILABLE" | "UNAVAILABLE";

function initials(value: string) {
  const words = value.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/**
 * An agent's own lead-distribution availability, read from the existing
 * endpoint and kept current while the page is open: re-read every minute and
 * when the tab regains focus. Only AGENT memberships have availability (the
 * database only routes leads to agents), so other roles never request it.
 */
function useOwnAvailability(company: CompanyChoice | null | undefined) {
  const enabled = company?.role === "AGENT";
  const [status, setStatus] = useState<Availability | null>(null);
  const [saving, setSaving] = useState(false);

  const read = useCallback(() => fetch(AVAILABILITY_PATH, {credentials: "same-origin", cache: "no-store"})
    .then(response => response.ok ? response.json() : null)
    .then((result: {data?: {organizationId?: string; ownAvailability?: {status: string; unavailableUntil?: string | null} | null}} | null) => {
      const data = result?.data;
      // The server answers for the active company; ignore it if another tab switched companies.
      if (!data || !company || data.organizationId?.toLowerCase() !== company.id.toLowerCase()) return;
      const own = data.ownAvailability;
      const expired = own?.unavailableUntil != null && Date.parse(own.unavailableUntil) <= Date.now();
      setStatus(own?.status === "UNAVAILABLE" && !expired ? "UNAVAILABLE" : "AVAILABLE");
    })
    .catch(() => { /* Keep the last known status; the next refresh tries again. */ }), [company]);

  useEffect(() => {
    if (!enabled) return;
    void read();
    const timer = setInterval(() => void read(), AVAILABILITY_REFRESH_MS);
    const onFocus = () => void read();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [enabled, read]);

  const change = async (next: Availability) => {
    if (!company || saving || next === status) return;
    const previous = status;
    setStatus(next); setSaving(true);
    try {
      await leadRequest(AVAILABILITY_PATH, "PATCH", {status: next, unavailableUntil: null, reason: next === "UNAVAILABLE" ? "Set from the account menu" : null}, company.id);
      toast.success(next === "AVAILABLE" ? "You are available for new leads." : "You are away. New leads skip you while away.");
    } catch (error) {
      setStatus(previous);
      toast.error(error instanceof Error ? error.message : "Your availability could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  return {enabled, status, saving, change};
}

/** The signed-in person's menu: who they are, live time, availability (agents), theme, settings and sign-out. */
export function AccountMenu({ user, company }: { user: { name?: string | null; email: string }; company?: CompanyChoice | null }) {
  const { theme, setTheme } = useTheme();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const now = useLiveClock();
  const availability = useOwnAvailability(company);
  const name = user.name?.trim() || user.email;
  const role = company?.role ? ROLE_LABELS[company.role] ?? company.role : null;
  const away = availability.status === "UNAVAILABLE";

  async function signOut() {
    if (pending) return;
    setPending(true); setFailed(false);
    try { await logout(); window.location.replace("/login"); }
    catch { setFailed(true); setPending(false); }
  }

  const avatar = (size: "sm" | "lg") => <span className="relative shrink-0" aria-hidden="true">
    <span className={cn("flex items-center justify-center rounded-full border bg-secondary font-semibold text-primary", size === "sm" ? "size-8 text-[11px]" : "size-10 text-sm")}>
      {pending ? <LoaderCircle className="size-3.5 animate-spin" /> : initials(name)}
    </span>
    {availability.enabled && availability.status && <span className={cn("absolute -right-0.5 -bottom-0.5 rounded-full border-2 border-card transition-colors", size === "sm" ? "size-3" : "size-3.5", away ? "bg-amber-500" : "bg-emerald-500")} />}
  </span>;

  return <div className="relative">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2 rounded-full px-1 md:rounded-lg md:pr-2" aria-label={`Account menu for ${name}`} title={name} data-testid="account-menu" />}>
        {avatar("sm")}
        <span className="hidden min-w-0 text-left leading-tight lg:block">
          <span className="block max-w-40 truncate text-[13px] font-medium">{name}</span>
          {role && <span className="block text-[11px] font-normal text-muted-foreground">{role}{availability.enabled && availability.status ? ` · ${away ? "Away" : "Available"}` : ""}</span>}
        </span>
        <ChevronDown className="hidden size-3.5 text-muted-foreground md:block" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-3 px-2 py-2.5">
            {avatar("lg")}
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              {user.name?.trim() && <span className="block truncate text-xs font-normal">{user.email}</span>}
              {company && <span className="mt-0.5 block truncate text-[11px] font-normal">{company.name}{role ? ` · ${role}` : ""}</span>}
            </span>
          </DropdownMenuLabel>
          <div className="mx-2 mb-1.5 flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground" aria-live="off">
            <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{now ? <>{clockDate.format(now)} · <span className="text-foreground">{clockTime.format(now)}</span> GST</> : "Dubai time"}</span>
          </div>
        </DropdownMenuGroup>
        {availability.enabled && <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Lead availability</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={availability.status ?? ""} onValueChange={value => void availability.change(value as Availability)} aria-label="Lead availability">
              <DropdownMenuRadioItem value="AVAILABLE" disabled={availability.saving || !availability.status}><span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />Available for new leads</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="UNAVAILABLE" disabled={availability.saving || !availability.status}><span className="size-2 rounded-full bg-amber-500" aria-hidden="true" />Away</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuGroup>
        </>}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme} aria-label="Color theme">
            {([{ value: "light", label: "Light", icon: Sun }, { value: "dark", label: "Dark", icon: Moon }, { value: "system", label: "System", icon: Monitor }] as const).map(({ value, label, icon: Icon }) =>
              <DropdownMenuRadioItem key={value} value={value}><Icon aria-hidden="true" />{label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings/company" />}><Settings2 aria-hidden="true" />Company settings</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => void signOut()}><LogOut aria-hidden="true" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {failed && <p role="alert" className="absolute top-11 right-0 z-50 w-60 rounded-lg border bg-popover p-3 text-xs leading-5 text-destructive shadow-md">Sign-out could not be completed. Please try again.</p>}
  </div>;
}
