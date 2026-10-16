"use client";

import Link from "next/link";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function ErrorState({ reset }: { reset: () => void }) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center" aria-labelledby="error-title">
      <CircleAlert className="mb-5 size-10 text-destructive" aria-hidden="true" />
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Something went wrong</p>
      <h1 id="error-title" className="mt-3 text-2xl font-semibold tracking-tight">We couldn’t load this page.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Try loading it again. If the problem continues, return to the homepage.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={reset} size="lg"><RotateCcw aria-hidden="true" />Try again</Button>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>Back to home</Link>
      </div>
    </section>
  );
}
