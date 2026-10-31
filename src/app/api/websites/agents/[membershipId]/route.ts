import { agentCardResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{membershipId: string}>};

export async function PUT(request: Request, context: Context) {
  return agentCardResponse(request, (await context.params).membershipId);
}
