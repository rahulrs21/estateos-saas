import { connection } from "next/server";
import { authJson } from "@/modules/auth/server/http";
import { authorizeLeadRead, leadErrorResponse, leadMutationResponse } from "@/modules/leads/server/http";
import { updateLead } from "@/modules/leads/server/service";
import { getLeadDetailData } from "@/modules/leads/server/views";

type Context = { params: Promise<{ leadId: string }> };
export async function GET(request: Request, context: Context) {
  await connection();
  try {
    await authorizeLeadRead(request);
    const { leadId } = await context.params;
    const data = await getLeadDetailData(leadId, new URL(request.url).searchParams.get("activityPage") ?? undefined);
    return authJson({ data });
  } catch (error) { return leadErrorResponse(error); }
}
export async function PATCH(request: Request, context: Context) {
  return leadMutationResponse(request, updateLead, (await context.params).leadId);
}
