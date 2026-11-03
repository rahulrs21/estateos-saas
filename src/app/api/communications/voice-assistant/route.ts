import { saveVoiceAssistantResponse, voiceAssistantResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return voiceAssistantResponse(request);
}

export async function PUT(request: Request) {
  return saveVoiceAssistantResponse(request);
}
