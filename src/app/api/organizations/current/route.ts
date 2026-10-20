import { companyMutationResponse } from "@/modules/organizations/server/http";
import { updateCompany } from "@/modules/organizations/server/service";

// Cache Components requires Node.js; runtime segment exports are unsupported.
export async function PATCH(request: Request) {
  return companyMutationResponse(request, updateCompany);
}
