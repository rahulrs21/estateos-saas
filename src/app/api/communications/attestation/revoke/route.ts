import { revokeAttestationResponse } from "@/modules/communications/server/http";

export async function POST(request: Request) {
  return revokeAttestationResponse(request);
}
