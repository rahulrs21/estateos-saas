import { connection } from "next/server";
import { generateDraftResponse } from "@/modules/ai/content/server/generate";

// Anthropic streaming and SQL Connect need the Node.js runtime (the default).
export async function POST(request: Request) {
  await connection();
  return generateDraftResponse(request);
}
