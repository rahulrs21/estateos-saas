import { simulatorWebsiteResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request) {
  return simulatorWebsiteResponse(request);
}
