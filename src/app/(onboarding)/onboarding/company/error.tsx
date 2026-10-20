"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboardingError({ reset }: { reset: () => void }) {
  return <main id="main-content" className="mx-auto max-w-xl space-y-5 p-8 py-20"><h1 className="text-2xl font-semibold">Company setup is temporarily unavailable</h1><p className="text-sm leading-6 text-muted-foreground">We couldn’t load your company memberships. Try again, or sign in again if your session has expired.</p><div className="flex items-center gap-5"><Button onClick={reset}>Try again</Button><Link href="/login" className="text-sm font-medium text-primary">Go to login</Link></div></main>;
}
