import { connection } from "next/server";
import { authJson } from "@/modules/auth/server/http";
import { authorizeLeadRead, leadErrorResponse, leadMutationResponse } from "@/modules/leads/server/http";
import { createLead } from "@/modules/leads/server/service";
import { getLeadsPageData } from "@/modules/leads/server/views";

export async function GET(request: Request) {
  await connection();
  try {
    await authorizeLeadRead(request);
    const parameters = new URL(request.url).searchParams;
    const filters: Record<string, string | string[]> = {};
    for (const key of new Set(parameters.keys())) {
      const values = parameters.getAll(key);
      filters[key] = values.length > 1 ? values : values[0];
    }
    return authJson({ data: await getLeadsPageData(filters) });
  } catch (error) { return leadErrorResponse(error); }
}

export async function POST(request: Request) {
  return leadMutationResponse(request, createLead, undefined, 201);
}
