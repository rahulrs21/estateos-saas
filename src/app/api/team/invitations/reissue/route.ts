import { companyMutationResponse } from "@/modules/organizations/server/http";
import { reissueTeamInvitation } from "@/modules/organizations/server/team-service";
export async function POST(request: Request) { return companyMutationResponse(request, reissueTeamInvitation); }
