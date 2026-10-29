import { crmMutationResponse, crmReadResponse } from "@/modules/leads/server/http";
import { createInventoryRecord, listInventory } from "@/modules/inventory/server/service";

type Context = {params: Promise<{resource: string}>};

export async function GET(request: Request, context: Context) {
  const {resource} = await context.params;
  return crmReadResponse(request, (input) => listInventory(resource, input));
}

export async function POST(request: Request, context: Context) {
  const {resource} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => createInventoryRecord(resource, input, organizationId), {}, 201);
}
