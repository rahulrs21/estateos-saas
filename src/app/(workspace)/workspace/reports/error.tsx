"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ReportsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("Lead reporting failed", error.digest), [error.digest]);
  return <main className="mx-auto max-w-2xl px-5 py-16 text-center"><p className="text-xs font-semibold tracking-widest text-primary uppercase">Report unavailable</p><h1 className="mt-3 text-2xl font-semibold">We couldn’t load these analytics.</h1><p className="mt-2 text-sm text-muted-foreground">Try again, or choose a shorter date range and review your company database connection.</p><div className="mt-6 flex justify-center gap-3"><Button type="button" onClick={reset}>Try again</Button><Link className={buttonVariants({ variant: "outline" })} href="/workspace/dashboard">Back to dashboard</Link></div></main>;
}
