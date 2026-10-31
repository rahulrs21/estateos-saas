import { deleteSectionTemplateResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{templateId: string}>};

export async function DELETE(request: Request, context: Context) { return deleteSectionTemplateResponse(request, (await context.params).templateId); }
