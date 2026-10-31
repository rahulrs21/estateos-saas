import { mediaArchiveResponse, mediaUpdateResponse } from "@/modules/websites/server/http";

type Context = {params: Promise<{mediaId: string}>};

export async function PUT(request: Request, context: Context) { return mediaUpdateResponse(request, (await context.params).mediaId); }
export async function DELETE(request: Request, context: Context) { return mediaArchiveResponse(request, (await context.params).mediaId); }
