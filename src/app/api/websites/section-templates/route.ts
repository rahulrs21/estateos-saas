import { saveSectionTemplateResponse, sectionTemplatesResponse } from "@/modules/websites/server/http";

export const GET = (request: Request) => sectionTemplatesResponse(request);
export const POST = (request: Request) => saveSectionTemplateResponse(request);
