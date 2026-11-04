import { simulatorCallResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return simulatorCallResponse(request);
}
