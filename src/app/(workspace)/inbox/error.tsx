"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function InboxError({reset}: {reset: () => void}) { return <ErrorState reset={reset} />; }
