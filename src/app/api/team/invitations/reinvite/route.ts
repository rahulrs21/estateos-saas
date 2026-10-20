import { companyMutationResponse } from "@/modules/organizations/server/http";
import { reinviteTeamMember } from "@/modules/organizations/server/team-service";

export async function POST(request: Request) {
  return companyMutationResponse(request, reinviteTeamMember);
}
