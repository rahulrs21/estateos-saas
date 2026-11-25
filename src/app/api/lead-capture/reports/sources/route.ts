import { authorizeLeadRead, leadErrorResponse } from "@/modules/leads/server/http";
import { getLeadSourceReportCsv } from "@/modules/lead-capture/server/reports";

/**
 * Phase 7E.4: the "Where leads come from" report as CSV (docs/LEAD_ATTRIBUTION_PLAN.md). The same period, filters and
 * visibility as the reports page: the server resolves the member and company; the query string only narrows it.
 */
export async function GET(request: Request) {
  try {
    await authorizeLeadRead(request);
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const { csv, fileName } = await getLeadSourceReportCsv(params);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return leadErrorResponse(error);
  }
}
