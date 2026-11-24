import { connection } from "next/server";
import { getAppOrigin } from "@/modules/auth/server/config";

/*
 * The lead form embed script (docs/LEAD_ATTRIBUTION_PLAN.md#2-capture-on-every-path). An agency's website includes
 *   <div data-estateos-form data-src="https://…/forms/{publicId}"></div><script src="https://…/embed/lead-form.js" async></script>
 * and the script turns each such element into the form's iframe, adding the host page's UTM tags and click IDs (which
 * the browser otherwise hides from an iframe), the page's address without its query (eo_page) and the host page's
 * referrer (eo_ref). Only addresses of this EstateOS server's own forms are embedded. No cookies, no other requests.
 */

const PARAMS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid", "ttclid"];

function script(origin: string) {
  return `(function () {
  var ORIGIN = ${JSON.stringify(origin)};
  var PARAMS = ${JSON.stringify(PARAMS)};
  var FORM = new RegExp("^/forms/[A-Za-z0-9_-]{32,64}$");
  function embed(el) {
    if (el.getAttribute("data-estateos-ready")) return;
    var src;
    try { src = new URL(el.getAttribute("data-src") || "", ORIGIN); } catch (e) { return; }
    if (src.origin !== ORIGIN || !FORM.test(src.pathname)) return;
    var here = new URL(window.location.href);
    for (var i = 0; i < PARAMS.length; i++) { var v = here.searchParams.get(PARAMS[i]); if (v) src.searchParams.set(PARAMS[i], v.slice(0, 512)); }
    src.searchParams.set("eo_page", (here.origin + here.pathname).slice(0, 1024));
    if (document.referrer && /^https?:/.test(document.referrer)) { try { var r = new URL(document.referrer); src.searchParams.set("eo_ref", r.origin + "/"); } catch (e) {} }
    var frame = document.createElement("iframe");
    frame.src = src.toString();
    frame.title = el.getAttribute("data-title") || "Property enquiry form";
    frame.width = "100%";
    frame.height = String(Math.min(Math.max(parseInt(el.getAttribute("data-height") || "720", 10) || 720, 300), 2000));
    frame.loading = "lazy";
    frame.style.border = "0";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    el.setAttribute("data-estateos-ready", "1");
    el.appendChild(frame);
  }
  function run() { var els = document.querySelectorAll("[data-estateos-form]"); for (var i = 0; i < els.length; i++) embed(els[i]); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
})();
`;
}

export async function GET() {
  // Built per request: the server's public origin is a runtime setting.
  await connection();
  return new Response(script(getAppOrigin()), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
}
