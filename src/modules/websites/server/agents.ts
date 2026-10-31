import "server-only";

import * as sql from "@dataconnect/admin-generated";
import { executeWorkspaceOperation } from "@/lib/firebase/dataconnect";
import type { requireActiveOrganizationRequest } from "@/modules/organizations/server/context";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { canonicalUuid } from "@/modules/organizations/server/identifiers";
import { validateInput } from "@/modules/organizations/server/validation";
import { presentAgent } from "../linked";
import { agentCardSchema, membershipIdSchema } from "../policy";
import { isAdministrator } from "./store";

type Context = Awaited<ReturnType<typeof requireActiveOrganizationRequest>>;

/*
 * Agent cards for contact sections (docs/AI_PAGE_BUILDER.md#contact-details).
 * Owners and administrators choose which active member a page shows and set
 * that member's public title, phone and WhatsApp. Pages store only the
 * membership ID; the details are re-read from the membership on every read.
 */

const administratorsOnly = (context: Context) => {
  if (!isAdministrator(context)) throw new WorkspaceError("FORBIDDEN", 403, "Only company owners and administrators can manage agent cards.");
};

export async function listWebsiteAgents(context: Context) {
  administratorsOnly(context);
  const data = await executeWorkspaceOperation(() => sql.listWebsiteAgents(context.request.dc, {organizationId: context.organizationId}, context.request.options), "ListWebsiteAgents");
  return data.agents.map(agent => ({...presentAgent(agent), role: agent.role}));
}

export async function saveAgentCard(context: Context, rawId: string, raw: unknown) {
  administratorsOnly(context);
  const membershipId = canonicalUuid(validateInput(membershipIdSchema, rawId));
  const card = validateInput(agentCardSchema, raw);
  await executeWorkspaceOperation(() => sql.updateWebsiteAgentCard(context.request.dc, {organizationId: context.organizationId, membershipId, ...card}, context.request.options), "UpdateWebsiteAgentCard");
  return listWebsiteAgents(context);
}
