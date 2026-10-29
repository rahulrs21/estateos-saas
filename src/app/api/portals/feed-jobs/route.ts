import { crmMutationResponse } from "@/modules/leads/server/http";
import { runFeedDryRun } from "@/modules/portals/server/service";

export async function POST(request: Request) {
  return crmMutationResponse(request, runFeedDryRun, {}, 201);
}
