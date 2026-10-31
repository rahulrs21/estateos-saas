import { mediaListResponse, uploadMediaResponse } from "@/modules/websites/server/http";

export const GET = (request: Request) => mediaListResponse(request);
export const POST = (request: Request) => uploadMediaResponse(request);
