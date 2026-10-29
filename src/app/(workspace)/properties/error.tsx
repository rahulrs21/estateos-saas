"use client";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function Error({reset}: {error: Error & {digest?: string}; reset: () => void}) { return <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center p-6 text-center"><CircleAlert className="size-8 text-destructive" aria-hidden="true"/><h1 className="mt-4 text-xl font-semibold">Property inventory could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">Try again. If the problem continues, check the company database connection.</p><Button className="mt-5" onClick={reset}><RotateCcw aria-hidden="true"/>Try again</Button></main>; }
