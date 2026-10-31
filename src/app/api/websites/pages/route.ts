import { createPageResponse } from "@/modules/websites/server/http";

export const POST = (request: Request) => createPageResponse(request);
