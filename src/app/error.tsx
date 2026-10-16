"use client";

import { ErrorState } from "@/components/shared/error-state";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main id="main-content"><ErrorState reset={reset} /></main>;
}
