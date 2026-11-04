import { simulatorResetResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return simulatorResetResponse(request);
}
