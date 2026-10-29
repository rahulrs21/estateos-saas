"use client";

import { Button } from "@/components/ui/button";

export default function ErrorView({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl rounded-xl border bg-card p-8 text-center">
    <h1 className="text-xl font-semibold">Property portal settings are unavailable</h1>
    <p className="mt-2 text-sm text-muted-foreground">Try again. If the problem continues, check your company database connection.</p>
    <Button type="button" className="mt-5" onClick={reset}>Try again</Button>
  </section>;
}
