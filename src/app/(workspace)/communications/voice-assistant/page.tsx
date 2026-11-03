import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CommunicationsTabs } from "@/modules/communications/components/communications-tabs";
import { VoiceAssistantPanel } from "@/modules/communications/components/voice-assistant";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "Voice assistant", robots: { index: false, follow: false } };

async function AuthenticatedVoiceAssistant() {
  const { activeCompany } = await requireCompanyWorkspace();
  const administrator = activeCompany.role === "OWNER" || activeCompany.role === "ADMIN";
  return <div className="space-y-5">
    <PageHeader eyebrow="Communications" title="Voice assistant" description="Configure an AI phone assistant and try it with simulated calls. Test mode only: it does not place or answer calls." />
    <CommunicationsTabs current="voice" role={activeCompany.role} />
    {administrator ? <VoiceAssistantPanel organizationId={activeCompany.id} />
      : <p className="rounded-lg border p-4 text-sm text-muted-foreground">Only owners and administrators can configure or test the voice assistant.</p>}
  </div>;
}

export default function VoiceAssistantPage() {
  return <Suspense fallback={<PageSkeleton />}><AuthenticatedVoiceAssistant /></Suspense>;
}
