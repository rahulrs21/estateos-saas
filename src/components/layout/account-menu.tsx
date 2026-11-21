"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircle, LogOut, Monitor, Moon, Settings2, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logout } from "@/modules/auth/client";

function initials(value: string) {
  const words = value.replace(/@.*$/, "").split(/[\s._-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}

/** The signed-in person's menu: who they are, the colour theme, settings and sign-out. */
export function AccountMenu({ user, companyName }: { user: { name?: string | null; email: string }; companyName?: string }) {
  const { theme, setTheme } = useTheme();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const name = user.name?.trim() || user.email;

  async function signOut() {
    if (pending) return;
    setPending(true); setFailed(false);
    try { await logout(); window.location.replace("/login"); }
    catch { setFailed(true); setPending(false); }
  }

  return <div className="relative">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label={`Account menu for ${name}`} title={name} data-testid="account-menu" />}>
        <span className="flex size-8 items-center justify-center rounded-full border bg-muted text-[11px] font-semibold text-foreground/80" aria-hidden="true">{pending ? <LoaderCircle className="size-3.5 animate-spin" /> : initials(name)}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            {user.name?.trim() && <span className="block truncate text-xs font-normal">{user.email}</span>}
            {companyName && <span className="mt-1 block truncate text-[11px] font-normal">{companyName}</span>}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
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
