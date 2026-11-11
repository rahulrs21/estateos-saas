"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, ImageOff, Images, Paperclip, Reply, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { communicationsGet } from "@/modules/communications/client";
import { formatLeadDate } from "@/modules/leads/components/lead-ui";
import { DELIVERY_LABELS, type DeliveryStatus } from "../model";
import type { ConversationView, MessageListView } from "../server/conversations";
import { ContactAvatar, listTime } from "./inbox-ui";

/*
 * An email shown like a mail client (docs/INBOX_SECURITY.md#safe-rendering).
 * The formatted version is cleaned on the server and displayed only inside a
 * sandboxed frame: no scripts can run (sandbox without allow-scripts, and a
 * content policy without script sources), it cannot reach EstateOS's page,
 * forms are blocked, links open in a new tab without a referrer, and remote
 * images (often tracking pixels) load only when the member asks.
 */

type Message = MessageListView["messages"][number];

const REMOTE = /\s(src|background)\s*=\s*"https?:|url\(\s*['"]?https?:/i;

function frameDocument(html: string, showImages: boolean) {
  const images = showImages ? "data: cid: https: http:" : "data: cid:";
  const policy = `default-src 'none'; style-src 'unsafe-inline'; img-src ${images}; font-src data:${showImages ? " https:" : ""}; base-uri 'none'; form-action 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="referrer" content="no-referrer"><base target="_blank">
<style>html,body{margin:0;padding:0;background:#ffffff;color:#202124}body{padding:16px 18px;font:14px/1.55 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;word-break:break-word}img{max-width:100%;height:auto}table{max-width:100%}a{color:#1a73e8}pre{white-space:pre-wrap}</style>
</head><body>${html}</body></html>`;
}

/** The cleaned HTML in a sandboxed frame that grows to its content. */
function SafeEmailFrame({html, showImages, title}: {html: string; showImages: boolean; title: string}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(120);
  const srcDoc = useMemo(() => frameDocument(html, showImages), [html, showImages]);
  const measure = useCallback(() => {
    // allow-same-origin (without allow-scripts) lets EstateOS measure the frame; the email still cannot run code.
    const document = frame.current?.contentDocument;
    // + the frame's 1px borders (and a little room), so the email never shows an inner scrollbar.
    if (document?.documentElement) setHeight(Math.min(20_000, Math.max(80, document.documentElement.scrollHeight + 4)));
  }, []);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    let observer: ResizeObserver | null = null;
    const onLoad = () => {
      measure();
      observer?.disconnect();
      const body = node.contentDocument?.body;
      if (body && typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(measure); observer.observe(body); }
    };
    node.addEventListener("load", onLoad);
    return () => { node.removeEventListener("load", onLoad); observer?.disconnect(); };
  }, [measure, srcDoc]);
  return <iframe ref={frame} title={title} srcDoc={srcDoc} sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"
    data-testid="email-html" className="block w-full rounded-lg border bg-white" style={{height}} />;
}


/** One email in a thread. Older emails start folded to a single line, as in a mail client; the formatted version is fetched only once an email is opened. */
export function EmailMessage({message, conversation, defaultOpen = true}: {message: Message; conversation: ConversationView; defaultOpen?: boolean}) {
  const inbound = message.direction === "INBOUND";
  const mailbox = conversation.channelConnection?.externalAccountReference ?? null;
  const fromName = inbound ? (conversation.contact?.fullName || conversation.customerName || message.senderIdentity || conversation.customerIdentity) : (message.author?.displayName ?? "EstateOS");
  const fromAddress = inbound ? (message.senderIdentity ?? conversation.customerIdentity) : mailbox;
  const to = inbound ? (message.recipientIdentity ?? mailbox) : (message.recipientIdentity ?? conversation.customerIdentity);
  const at = message.providerTimestamp ?? message.createdAt;
  // Inbound email: its formatted version is fetched on demand (stored, or looked up once from Gmail).
  const wantsHtml = inbound && !message.contentRedactedAt && (message.contentHtmlBytes === null || message.contentHtmlBytes === undefined || message.contentHtmlBytes > 0);
  const [open, setOpen] = useState(defaultOpen);
  const [html, setHtml] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "done">(wantsHtml ? "idle" : "done");
  const [showImages, setShowImages] = useState(false);
  const [showText, setShowText] = useState(false);
  const fetched = useRef(false);
  useEffect(() => {
    if (!wantsHtml || !open || fetched.current) return;
    fetched.current = true;
    communicationsGet<{html: string | null}>(`/api/inbox/conversations/${conversation.id}/messages/${message.id}/html`, "The formatted email could not be loaded.")
      .then(data => { setHtml(data.html); setState("done"); }, () => setState("done"));
  }, [wantsHtml, open, conversation.id, message.id]);
  const remote = Boolean(html && REMOTE.test(html));
  const snippet = message.contentRedactedAt ? "Removed under the company's retention period." : (message.content ?? "").replace(/\s+/g, " ").slice(0, 160);
  const reply = () => {
    const box = document.getElementById(`draft-${conversation.id}`);
    if (box instanceof HTMLTextAreaElement) { box.focus(); box.scrollIntoView({block: "nearest"}); }
  };

  return <li className="list-none" data-direction={message.direction} data-testid="email-message">
    <article className={cn("overflow-hidden rounded-xl border bg-card transition-shadow", open ? "shadow-sm" : "shadow-none hover:shadow-xs")}>
      {/* The header folds and unfolds the email. */}
      <header className="flex items-start gap-3 px-4 py-3">
        <ContactAvatar name={fromName} size="md" className="mt-0.5" />
        <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
          <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm"><span className="font-semibold">{fromName}</span>
            {open && fromAddress && <span className="truncate text-xs text-muted-foreground">&lt;{fromAddress}&gt;</span>}</span>
          {open ? <span className="block truncate text-xs text-muted-foreground">to {to ?? "you"}</span>
            : <span dir="auto" className="block truncate text-xs text-muted-foreground">{snippet || "(no text)"}</span>}
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {message.attachments.length > 0 && <Paperclip aria-label={`${message.attachments.length} attachment${message.attachments.length === 1 ? "" : "s"}`} className="size-3.5" />}
            <time dateTime={at} title={formatLeadDate(at, true)}>{open ? formatLeadDate(at, true) : listTime(at)}</time>
            {open && inbound && <Button size="icon-xs" variant="ghost" aria-label="Reply" title="Reply" onClick={reply}><Reply aria-hidden /></Button>}
          </span>
          {!inbound && <Badge variant="outline" className="h-5 text-[11px]">{DELIVERY_LABELS[message.deliveryStatus as DeliveryStatus] ?? message.deliveryStatus}</Badge>}
          {message.simulated && <Badge variant="destructive" className="h-4 px-1 text-[10px]">SIMULATED</Badge>}
        </div>
      </header>

      {open && <div className="space-y-3 px-4 pb-4">
        {message.contentRedactedAt ? <p className="text-sm italic text-muted-foreground">Removed under the company&apos;s retention period.</p>
          : state !== "done" ? <div className="space-y-2" role="status" aria-label="Loading the email"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24 w-full" /></div>
          : html && !showText ? <>
            {remote && !showImages && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs" data-testid="email-images-hidden">
              <span className="flex items-center gap-2 text-muted-foreground"><ImageOff aria-hidden className="size-4" />Images are hidden. Loading them can tell the sender you opened this email.</span>
              <Button size="sm" variant="outline" onClick={() => setShowImages(true)}><Images aria-hidden />Show images</Button>
            </div>}
            <SafeEmailFrame html={html} showImages={showImages} title={`Email from ${fromName}`} />
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><ShieldAlert aria-hidden className="size-3.5" />Shown safely: scripts are blocked and links open in a new tab. Check the address before you click.</span>
              <button type="button" className="underline underline-offset-2" onClick={() => setShowText(true)}>Show as plain text</button>
            </div>
          </>
          : <>
            <p dir="auto" className="whitespace-pre-wrap wrap-break-word text-sm leading-6">{message.content ?? `[${message.messageType.toLowerCase()} message]`}</p>
            {html && <button type="button" className="text-[11px] text-muted-foreground underline underline-offset-2" onClick={() => setShowText(false)}>Show formatted email</button>}
          </>}

        {message.attachments.length > 0 && <ul className="flex flex-wrap gap-2 border-t pt-3" aria-label="Attachments">{message.attachments.map(item => <li key={item.id} data-testid="inbox-attachment"
          className="flex min-w-0 max-w-full items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs sm:max-w-[16rem]">
          <FileText aria-hidden className="size-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1"><span className="block truncate font-medium">{item.fileName}</span>
            <span className="block text-muted-foreground">{item.sizeBytes > 0 ? `${Math.max(1, Math.ceil(item.sizeBytes / 1024))} KB` : ""}{item.scanStatus === "BLOCKED" ? " · blocked" : !item.available ? " · not stored (file type not allowed)" : item.scanStatus === "NOT_SCANNED" ? " · not virus-scanned" : ""}</span></span>
          {/* Downloaded through an authorized, audited route; never opened inline. */}
          {item.available && <a href={`/api/inbox/conversations/${conversation.id}/attachments/${item.id}`} download aria-label={`Download ${item.fileName}`} className="rounded p-1 hover:bg-muted"><Download aria-hidden className="size-4" /></a>}
        </li>)}</ul>}
      </div>}
    </article>
  </li>;
}
