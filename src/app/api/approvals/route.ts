import { approvalsResponse } from "@/modules/automations/server/http";

export async function GET(request: Request) {
  return approvalsResponse(request);
}
