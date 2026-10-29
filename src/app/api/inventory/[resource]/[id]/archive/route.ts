import { crmMutationResponse } from "@/modules/leads/server/http";
import { archiveInventoryRecord } from "@/modules/inventory/server/service";

type Context = {params: Promise<{resource: string; id: string}>};

export async function POST(request: Request, context: Context) {
  const {resource, id} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => archiveInventoryRecord(resource, Object.assign({}, input, {id}), organizationId), {id});
}
