import { connection } from "next/server";
import { createTemplateResponse, listTemplatesResponse } from "@/modules/ai/content/server/http";

export async function GET(request: Request) {
  await connection();
  return listTemplatesResponse(request);
}

export async function POST(request: Request) {
  await connection();
  return createTemplateResponse(request);
}
