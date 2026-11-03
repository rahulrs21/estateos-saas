import { attestResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return attestResponse(request);
}
