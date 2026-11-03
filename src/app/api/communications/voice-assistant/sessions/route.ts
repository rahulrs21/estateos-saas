import { startVoiceTestResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return startVoiceTestResponse(request);
}
