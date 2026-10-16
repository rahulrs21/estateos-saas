"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";

import { Brand } from "@/components/shared/brand";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function MobileNavigation() {
  const [open, setOpen] = useState(false);
  const closeNavigation = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="size-10"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
          />
        }
      >
        <Menu className="size-5" aria-hidden="true" />
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(85vw,24rem)] overflow-y-auto">
        <SheetHeader className="gap-5 border-b p-6">
          <Brand />
          <div className="space-y-2">
            <SheetTitle>Explore EstateOS</SheetTitle>
            <SheetDescription>A connected workspace vision for your agency.</SheetDescription>
          </div>
        </SheetHeader>
        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 px-4 text-sm">
          <a href="#platform" onClick={closeNavigation} className="rounded-lg px-4 py-3.5 hover:bg-muted">The platform</a>
          <a href="#built-for-you" onClick={closeNavigation} className="rounded-lg px-4 py-3.5 hover:bg-muted">Built for your agency</a>
          <Link href="/workspace/dashboard" onClick={closeNavigation} className="rounded-lg px-4 py-3.5 hover:bg-muted">Workspace</Link>
          <Link href="/login" onClick={closeNavigation} className="rounded-lg px-4 py-3.5 hover:bg-muted">Log in</Link>
        </nav>
        <SheetFooter className="gap-4 border-t p-6">
          <Link href="/signup" onClick={closeNavigation} className={cn(buttonVariants({ className: "h-11 w-full gap-2" }))}>Get started <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <p className="text-xs leading-5 text-muted-foreground">Verified sign-in is available. Agency features are still in development.</p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
