import { decideSuggestionResponse } from "@/modules/communications/server/http";

export async function POST(request: Request, {params}: {params: Promise<{suggestionId: string}>}) {
  return decideSuggestionResponse(request, (await params).suggestionId);
}
