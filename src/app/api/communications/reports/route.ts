import { reportResponse } from "@/modules/communications/server/http";

export async function GET(request: Request) {
  return reportResponse(request);
}
