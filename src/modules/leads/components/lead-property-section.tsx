import { getLeadPropertyData, type LeadPropertyData } from "../server/property-service";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LeadPropertyPanel } from "./lead-property-panel";

export async function LeadPropertySection({leadId}: {leadId: string}) {
  let data: LeadPropertyData;
  try {
    data = await getLeadPropertyData({leadId});
  } catch (error) {
    if (!(error instanceof WorkspaceError)) throw error;
    return <Card><CardHeader><CardTitle>Property matching</CardTitle></CardHeader><CardContent><p role="alert" className="text-sm text-muted-foreground">{error.message}</p></CardContent></Card>;
  }
  return <LeadPropertyPanel leadId={leadId} initialData={data} />;
}
