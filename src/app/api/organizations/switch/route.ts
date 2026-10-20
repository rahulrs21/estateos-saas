import { companyMutationResponse } from "@/modules/organizations/server/http";
import { switchOrganization } from "@/modules/organizations/server/service";

// Cache Components requires Node.js; runtime segment exports are unsupported.
export async function POST(request: Request) {
  return companyMutationResponse(request, switchOrganization);
}
