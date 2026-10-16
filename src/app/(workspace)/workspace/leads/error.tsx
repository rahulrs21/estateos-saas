"use client";

import Link from "next/link";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function LeadsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center" aria-labelledby="leads-error-title">
    <CircleAlert className="size-9 text-destructive" aria-hidden="true" />
    <h1 id="leads-error-title" className="mt-5 text-2xl font-semibold">We couldn&apos;t load leads.</h1>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Please try again. Your existing records have not been changed by this page error.</p>
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Button size="lg" onClick={reset}><RotateCcw aria-hidden="true" />Try again</Button><Link href="/workspace/leads" className={buttonVariants({ variant: "outline", size: "lg" })}>Back to leads</Link></div>
  </section>;
}
