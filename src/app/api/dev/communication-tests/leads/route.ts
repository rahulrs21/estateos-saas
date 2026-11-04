import { simulatorLeadResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return simulatorLeadResponse(request);
}
