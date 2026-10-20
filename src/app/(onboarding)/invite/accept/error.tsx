"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function InvitationError({ reset }: { reset: () => void }) {
  return <main id="main-content"><ErrorState reset={reset} /></main>;
}
