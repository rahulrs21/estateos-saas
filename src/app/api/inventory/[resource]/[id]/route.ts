import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { getInventoryRecordRequired, updateInventoryRecord } from "@/modules/inventory/server/service";

type Context = {params: Promise<{resource: string; id: string}>};

export async function GET(request: Request, context: Context) {
  const {resource, id} = await context.params;
  return crmReadResponse(request, (input) => getInventoryRecordRequired(resource, Object.assign({}, input, {id})), {id});
}

export async function PATCH(request: Request, context: Context) {
  const {resource, id} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => updateInventoryRecord(resource, Object.assign({}, input, {id}), organizationId), {id});
}
