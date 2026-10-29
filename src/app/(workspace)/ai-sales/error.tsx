"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function AiSalesError({reset}: {reset: () => void}) { return <ErrorState reset={reset} />; }
