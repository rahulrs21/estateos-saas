import { crmMutationResponse } from "@/modules/leads/server/http";
import { createPaymentPlanInstallment } from "@/modules/inventory/server/service";

type Context = {params: Promise<{id: string}>};

export async function POST(request: Request, context: Context) {
  const {id} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => createPaymentPlanInstallment(Object.assign({}, input, {paymentPlanId: id}), organizationId), {paymentPlanId: id}, 201);
}
