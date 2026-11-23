import { connectResponse } from "@/modules/lead-ads/server/http";

/** Starts Facebook's sign-in for connecting Pages: returns its address and sets the sealed state cookie. */
export async function POST(request: Request) {
  return connectResponse(request);
}
