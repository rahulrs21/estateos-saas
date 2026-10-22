"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LeadFormsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error("Lead form settings failed", error.digest), [error.digest]);
  return <section className="mx-auto max-w-2xl rounded-2xl border p-8 text-center"><h1 className="text-xl font-semibold">Lead form settings are unavailable.</h1><p className="mt-2 text-sm text-muted-foreground">Refresh the page or confirm that you have company owner or administrator access.</p><Button className="mt-5" onClick={reset}>Try again</Button></section>;
}
