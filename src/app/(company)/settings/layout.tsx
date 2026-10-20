import WorkspaceLayout from "@/app/(workspace)/workspace/layout";
import { SettingsNavigation } from "@/modules/organizations/components/settings-navigation";
export { metadata } from "@/app/(workspace)/workspace/layout";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceLayout><SettingsNavigation />{children}</WorkspaceLayout>;
}
