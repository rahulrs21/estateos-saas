import { connection } from "next/server";
import { crmReadResponse } from "@/modules/leads/server/http";
import { requestClientIp } from "@/lib/rate-limit/server";
import { listInventoryMapPins } from "@/modules/inventory/server/service";
import { WorkspaceError } from "@/modules/organizations/server/errors";

/**
 * GET /api/maps/pins?resource=properties|listings&south=…&north=…&west=…&east=…&offset=…&<list filters>
 * One page of sanitized pins for the visible map area. Tenant, role and
 * assignment scope come from the verified session, never from the query.
 */
export async function GET(request: Request) {
  await connection();
  return crmReadResponse(request, input => {
    const {resource, ...filters} = input as Record<string, unknown>;
    if (resource !== "properties" && resource !== "listings") throw new WorkspaceError("VALIDATION_ERROR", 400, "Choose properties or listings.");
    return listInventoryMapPins(resource, filters, requestClientIp(request));
  });
}
