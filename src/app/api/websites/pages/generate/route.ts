import { generatePageResponse } from "@/modules/websites/server/http";

export const POST = (request: Request) => generatePageResponse(request);
