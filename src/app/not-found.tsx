import Link from "next/link";
import { ArrowLeft, MapPinOff } from "lucide-react";
import { Brand } from "@/components/shared/brand";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main-content" className="flex min-h-svh flex-col items-center justify-center px-6 py-12 text-center">
      <Link href="/" className="mb-12 rounded-lg" aria-label="EstateOS homepage"><Brand /></Link>
      <span className="mb-5 flex size-16 items-center justify-center rounded-2xl border bg-card"><MapPinOff className="size-7 text-primary" aria-hidden="true" /></span>
      <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">A little off the map.</h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">This page doesn’t exist or has moved. Let’s get you back to familiar ground.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3"><Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}><ArrowLeft aria-hidden="true" />Back to home</Link><Link href="/workspace/dashboard" className={buttonVariants({ size: "lg" })}>Workspace preview</Link></div>
    </main>
  );
}
