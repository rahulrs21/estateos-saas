import { saveSettingsResponse, settingsResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return settingsResponse(request);
}

export async function PUT(request: Request) {
  return saveSettingsResponse(request);
}