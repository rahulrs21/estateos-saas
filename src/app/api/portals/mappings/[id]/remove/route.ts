import { crmMutationResponse } from "@/modules/leads/server/http";
import { removePortalFieldMapping } from "@/modules/portals/server/service";

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  return crmMutationResponse(request, removePortalFieldMapping, await context.params);
}
