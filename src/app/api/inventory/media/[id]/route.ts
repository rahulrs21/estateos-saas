import { crmMutationResponse } from "@/modules/leads/server/http";
import { getFirebaseAdminStorageBucket } from "@/lib/firebase/admin";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { getInventoryMediaForDeletion, updateInventoryMediaOrder, updateInventoryMediaStatus } from "@/modules/inventory/server/service";

type Context = {params: Promise<{id: string}>};

export async function PATCH(request: Request, context: Context) {
  const {id} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => updateInventoryMediaOrder(id, input, organizationId), {id});
}

export async function POST(request: Request, context: Context) {
  const {id} = await context.params;
  return crmMutationResponse(request, async (input, organizationId) => {
    if (!input || typeof input !== "object" || (input as {action?: unknown}).action !== "delete") {
      throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose a supported media action.");
    }
    const {media} = await getInventoryMediaForDeletion(id, organizationId);
    if (media.status === "ACTIVE") await updateInventoryMediaStatus(id, "ACTIVE", "DELETING", organizationId);
    await getFirebaseAdminStorageBucket().file(media.storagePath).delete({ignoreNotFound: true});
    await updateInventoryMediaStatus(id, "DELETING", "DELETED", organizationId);
    return {deleted: true};
  }, {id});
}
