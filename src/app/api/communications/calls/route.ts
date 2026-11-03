import { logCallResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return logCallResponse(request);
}