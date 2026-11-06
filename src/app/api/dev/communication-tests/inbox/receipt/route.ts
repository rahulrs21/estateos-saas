import { simulatorReceiptResponse } from "@/modules/inbox/server/http";

export async function POST(request: Request) {
  return simulatorReceiptResponse(request);
}
