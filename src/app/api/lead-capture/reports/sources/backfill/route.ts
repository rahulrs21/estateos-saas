import { leadMutationResponse } from "@/modules/leads/server/http";
import { backfillLeadSources } from "@/modules/lead-capture/server/reports";

/**
 * Phase 7E.5: fills the sources of the company's leads that have none, from their own history
 * (docs/LEAD_ATTRIBUTION_PLAN.md). Owners and administrators only; the database checks the role too.
 */
export async function POST(request: Request) {
  return leadMutationResponse(request, backfillLeadSources);
}
