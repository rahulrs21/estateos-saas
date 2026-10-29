"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function DeveloperError({reset}: {reset: () => void}) { return <ErrorState reset={reset} />; }
