import { tickResponse } from "@/modules/automations/server/http";

/** The automation worker's tick (secret-authenticated; see docs/AUTOMATION_OPERATIONS.md). */
export async function POST(request: Request) {
  return tickResponse(request);
}
