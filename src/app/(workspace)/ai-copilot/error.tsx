"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function AiCopilotError({reset}: {reset: () => void}) { return <ErrorState reset={reset} />; }
