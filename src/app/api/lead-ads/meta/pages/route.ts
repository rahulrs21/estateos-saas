import { pagesResponse } from "@/modules/lead-ads/server/http";

/** The company's connected Facebook Pages, their forms and recent failed leads (OWNER or ADMIN). */
export async function GET(request: Request) {
  return pagesResponse(request);
}
