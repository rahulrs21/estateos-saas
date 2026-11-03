import "server-only";

import { validateInput } from "@/modules/organizations/server/validation";
import { member, sdk, type Context } from "./data";
import { idSchema } from "./workflows";

/*
 * My tasks (docs/WORKFLOW_BUILDER.md#tasks): the caller's pending lead
 * follow-ups and work tasks, and the team queue for OWNERs, ADMINs and
 * MANAGERs. The database decides what each member sees and may complete.
 * Lead follow-ups are completed through the existing lead endpoint.
 */

export async function listMyTasks(context: Context) {
  const data = await member(() => sdk.listMyTasks(context.request.dc, {organizationId: context.organizationId, limit: 100}, context.request.options));
  return {followUps: data.followUps, workTasks: data.workTasks, role: data.me?.role ?? context.membership.role, membershipId: context.membership.id};
}

export async function completeWorkTask(context: Context, rawId: string) {
  const id = validateInput(idSchema, rawId);
  await member(() => sdk.completeWorkTask(context.request.dc, {organizationId: context.organizationId, id}, context.request.options));
  return {id, status: "COMPLETED" as const};
}
