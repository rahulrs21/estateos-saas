import { crmMutationResponse } from "@/modules/leads/server/http";
import { requestClientIp } from "@/lib/rate-limit/server";
import { performMapLookup } from "@/modules/maps/server/service";

type Context = {params: Promise<{operation: string}>};

/** POST-only so lookups get the same origin, CSRF and session checks as mutations. */
export async function POST(request: Request, context: Context) {
  const {operation} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => performMapLookup(operation, input, organizationId, requestClientIp(request)));
}
