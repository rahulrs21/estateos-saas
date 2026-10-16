"use client";

import { useState } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { logout } from "@/modules/auth/client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true); setError(false);
    try {
      await logout();
      window.location.replace("/login");
    } catch { setError(true); setPending(false); }
  }

  return <div className="relative">
    <Button variant="ghost" size="icon-lg" onClick={signOut} disabled={pending} aria-label="Sign out" title="Sign out of all sessions">
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <LogOut className="size-4" aria-hidden="true" />}
    </Button>
    {error && <p role="alert" className="absolute top-11 right-0 z-20 w-60 rounded-lg border bg-popover p-3 text-xs leading-5 text-destructive shadow-md">Sign-out could not be completed. Please try again.</p>}
  </div>;
}
