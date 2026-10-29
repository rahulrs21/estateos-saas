import { crmMutationResponse } from "@/modules/leads/server/http";
import { removePaymentPlanInstallment, updatePaymentPlanInstallment } from "@/modules/inventory/server/service";

type Context = {params: Promise<{id: string; installmentId: string}>};

export async function PATCH(request: Request, context: Context) {
  const {id, installmentId} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => updatePaymentPlanInstallment(Object.assign({}, input, {paymentPlanId: id, id: installmentId}), organizationId), {paymentPlanId: id, id: installmentId});
}

export async function POST(request: Request, context: Context) {
  const {id, installmentId} = await context.params;
  return crmMutationResponse(request, (input, organizationId) => removePaymentPlanInstallment(Object.assign({}, input, {paymentPlanId: id, id: installmentId}), organizationId), {paymentPlanId: id, id: installmentId});
}
