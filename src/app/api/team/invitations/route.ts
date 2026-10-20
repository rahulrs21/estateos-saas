import { companyMutationResponse } from "@/modules/organizations/server/http";
import { inviteTeamMember } from "@/modules/organizations/server/team-service";
export async function POST(request: Request) { return companyMutationResponse(request, inviteTeamMember, 201); }
