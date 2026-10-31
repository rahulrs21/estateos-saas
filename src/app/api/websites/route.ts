import { overviewResponse } from "@/modules/websites/server/http";

export const GET = (request: Request) => overviewResponse(request);
