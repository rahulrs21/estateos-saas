import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Communications" };

export default function CommunicationsPage() {
  return <ModulePreview slug="communications" />;
}
