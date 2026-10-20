import { companyMutationResponse } from "@/modules/organizations/server/http";
import { revokeTeamInvitation } from "@/modules/organizations/server/team-service";
export async function POST(request: Request) { return companyMutationResponse(request, revokeTeamInvitation); }
