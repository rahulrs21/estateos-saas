import { NextResponse, type NextRequest } from "next/server";
import { loadPublishedPage } from "@/modules/websites/server/public";

/**
 * Real 404 status codes for public landing pages
 * (docs/WEBSITE_PUBLISHING.md#public-pages). The page itself streams, and a
 * notFound() after streaming starts keeps status 200 (with noindex). This
 * check runs before rendering: an address with no live, eligible publication
 * gets a plain 404 page. The page repeats the same lookup, so this is not an
 * authorization boundary; database errors fall through to the page.
 */
const NOT_FOUND_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Page not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#fafafa;color:#18181b}main{max-width:28rem;padding:2rem;text-align:center}a{color:inherit}</style></head>
<body><main><h1>Page not found</h1><p>This page is not available. It may have been unpublished or the address may be incorrect.</p><p><a href="/">Go to the home page</a></p></main></body></html>`;

function notFound() {
  return new NextResponse(NOT_FOUND_HTML, {status: 404, headers: {"Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}});
}

export async function proxy(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  if (segments.length !== 3) return notFound();
  let page: Awaited<ReturnType<typeof loadPublishedPage>>;
  try {
    page = await loadPublishedPage(decodeURIComponent(segments[1]), decodeURIComponent(segments[2]));
  } catch (error) {
    // A malformed address is not a page; a database failure is left to the page to report.
    if (error instanceof URIError) return notFound();
    return NextResponse.next();
  }
  return page ? NextResponse.next() : notFound();
}

export const config = {
  matcher: "/site/:path*",
};
