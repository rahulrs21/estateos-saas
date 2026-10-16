import type { Metadata } from "next";
import { ModulePreview } from "@/modules/workspace/components/module-preview";

export const metadata: Metadata = { title: "Developers" };

export default function DevelopersPage() {
  return <ModulePreview slug="developers" />;
}
