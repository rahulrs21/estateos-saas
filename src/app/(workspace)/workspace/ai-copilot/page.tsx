import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "AI Copilot" };

export default function AiCopilotPage() {
  return <ModulePreview slug="ai-copilot" />;
}
