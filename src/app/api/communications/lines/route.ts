import { createLineResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return createLineResponse(request);
}
