import { companyMutationResponse } from "@/modules/organizations/server/http";
import { acceptInvitation } from "@/modules/organizations/server/service";
export async function POST(request: Request) { return companyMutationResponse(request, acceptInvitation); }
