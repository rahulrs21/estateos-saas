import { crmMutationResponse } from "@/modules/leads/server/http";
import { attachInventoryAmenity } from "@/modules/inventory/server/service";

type Context = {params: Promise<{resource: string; id: string}>};

export async function POST(request: Request, context: Context) {
  const {resource, id} = await context.params;
  if (resource !== "projects" && resource !== "properties") {
    return Response.json({error: {code: "NOT_FOUND", message: "This inventory route is unavailable."}}, {status: 404});
  }
  return crmMutationResponse(request, (input, organizationId) => attachInventoryAmenity(resource, id, input, organizationId), {}, 201);
}
