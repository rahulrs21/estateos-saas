import { connection } from "next/server";
import { copilotChatResponse } from "@/modules/ai/server/chat";

// Anthropic streaming and SQL Connect need the Node.js runtime (the default).
export async function POST(request: Request) {
  await connection();
  return copilotChatResponse(request);
}
