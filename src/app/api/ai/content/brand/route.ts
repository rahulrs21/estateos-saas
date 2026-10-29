import { connection } from "next/server";
import { getBrandResponse, saveBrandResponse } from "@/modules/ai/content/server/http";

export async function GET(request: Request) {
  await connection();
  return getBrandResponse(request);
}

export async function PUT(request: Request) {
  await connection();
  return saveBrandResponse(request);
}
