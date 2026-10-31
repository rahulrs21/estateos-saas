import { agentsResponse } from "@/modules/websites/server/http";

export const GET = (request: Request) => agentsResponse(request);
