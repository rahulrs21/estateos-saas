import { completeSignupResponse, signupSetupResponse } from "@/modules/inbox/server/http";

/** One-click Connect WhatsApp (Meta's Embedded Signup): GET the popup setup, POST the popup's result. */
export async function GET(request: Request) {
  return signupSetupResponse(request);
}
export async function POST(request: Request) {
  return completeSignupResponse(request);
}
