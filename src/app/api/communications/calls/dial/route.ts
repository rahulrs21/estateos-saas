import { dialResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return dialResponse(request);
}
