import { simulatorStateResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return simulatorStateResponse(request);
}
