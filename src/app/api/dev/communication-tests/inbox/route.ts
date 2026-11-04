import { simulatorStateResponse } from "@/modules/inbox/server/http";

export async function GET(request: Request) {
  return simulatorStateResponse(request);
}
