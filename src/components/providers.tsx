"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delay={200}>{children}</TooltipProvider>
      {/* Confirmations and errors raised with toast(). Top centre keeps them off the Save and Cancel buttons at the bottom of panels and dialogs. */}
      <Toaster position="top-center" closeButton />
    </ThemeProvider>
  );
}
