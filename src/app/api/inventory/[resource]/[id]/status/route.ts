import { crmMutationResponse } from "@/modules/leads/server/http";
import { setListingStatus } from "@/modules/inventory/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";

type Context = {params: Promise<{resource: string; id: string}>};

/** One listing workflow step: {expectedStatus, status}. Only listings have a status workflow here. */
export async function POST(request: Request, context: Context) {
  const {resource, id} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => {
    if (resource !== "listings") throw new WorkspaceError("NOT_FOUND", 404, "This inventory resource has no status workflow.");
    return setListingStatus(id, input, organizationId);
  }, {id});
}
