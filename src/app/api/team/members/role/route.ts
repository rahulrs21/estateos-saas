import { companyMutationResponse } from "@/modules/organizations/server/http";
import { changeTeamRole } from "@/modules/organizations/server/team-service";
export async function PATCH(request: Request) { return companyMutationResponse(request, changeTeamRole); }
