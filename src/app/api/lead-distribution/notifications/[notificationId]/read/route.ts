import { crmMutationResponse } from "@/modules/leads/server/http";
import { markNotificationRead } from "@/modules/leads/distribution/service";

export async function POST(request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await context.params;
  return crmMutationResponse(request, markNotificationRead, { notificationId });
}
