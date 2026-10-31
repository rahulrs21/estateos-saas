"use client";
import { ErrorState } from "@/components/shared/error-state";
export default function WebsitesError({reset}: {reset: () => void}) { return <ErrorState reset={reset} />; }
