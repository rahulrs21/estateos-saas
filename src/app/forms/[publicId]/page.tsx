import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PublicLeadForm } from "@/modules/lead-capture/components/public-lead-form";
import { resolvePublicForm } from "@/modules/lead-capture/server/service";

export const metadata: Metadata = { title: "Property inquiry", robots: { index: false, follow: false } };

async function PublicCaptureContent({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const form = await resolvePublicForm(publicId);
  if (!form) notFound();
  return <PublicLeadForm form={form} />;
}

export default function PublicCapturePage({ params }: { params: Promise<{ publicId: string }> }) {
  return <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-background p-5"><div className="w-full max-w-xl animate-pulse rounded-2xl border bg-card p-8"><div className="h-6 w-2/3 rounded bg-muted" /><div className="mt-6 h-10 rounded bg-muted" /><div className="mt-4 h-10 rounded bg-muted" /><div className="mt-8 h-10 rounded bg-muted" /></div></main>}><PublicCaptureContent params={params} /></Suspense>;
}
