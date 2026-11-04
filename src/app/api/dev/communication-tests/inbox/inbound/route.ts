import { simulatorInboundResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request) {
  return simulatorInboundResponse(request);
}
