import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { CopilotWorkspace } from "@/modules/ai/components/copilot-workspace";
import { requireCompanyWorkspace } from "@/modules/organizations/server/workspace";

export const metadata: Metadata = { title: "AI Copilot" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Manager shortcuts from the AI Sales dashboard. Only these fixed questions can
 * be pre-filled; they are placed in the input box and never sent automatically.
 */
const PRESETS: Record<string, string> = {
  "team-pipeline": "Summarize my team's lead pipeline: how many leads are at each stage, which stages have leads waiting longest, and what we should focus on this week.",
  "overdue-follow-ups": "Which of my leads have overdue follow-ups? List them oldest first with the next step for each.",
  "unassigned-leads": "Which open leads are unassigned? List them with their requirements and how long they have been waiting, so I can assign them.",
};

/** The page only resolves the verified company; every Copilot call is authorized again on the server. */
async function AuthenticatedCopilot({searchParams}: {searchParams: SearchParams}) {
  const { activeCompany } = await requireCompanyWorkspace();
  const preset = (await searchParams).preset;
  const initialPrompt = typeof preset === "string" && Object.hasOwn(PRESETS, preset) ? PRESETS[preset] : undefined;
  return <div className="space-y-5">
    <PageHeader eyebrow="Intelligence" title="AI Copilot" description="Ask questions about your company's leads, properties, projects and follow-ups. Answers use live EstateOS data within your permissions; the Copilot cannot change records." />
    <CopilotWorkspace organizationId={activeCompany.id} companyName={activeCompany.name} initialPrompt={initialPrompt} />
  </div>;
}

export default function AiCopilotPage({searchParams}: {searchParams: SearchParams}) {
  return <Suspense fallback={<PageSkeleton />}>
    <AuthenticatedCopilot searchParams={searchParams} />
  </Suspense>;
}
