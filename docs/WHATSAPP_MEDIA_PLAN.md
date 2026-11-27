# Phase 7G: WhatsApp media (plan)

Status: **7G.1 built locally** (seeing media), not yet deployed. Decisions taken (2026-11-27), as recommended:
- attach from the property's media as well as from the computer;
- a 25 MB document cap;
- MP4 video up to 16 MB;
- media replies follow the company's approval setting;
- no voice recording in the browser in 7G.

It builds on the WhatsApp inbox ([WHATSAPP_INTEGRATION_PLAN.md](WHATSAPP_INTEGRATION_PLAN.md), Phase 7B.2).

## Built in 7G.1

- **Voice notes, audio and video play in the chat** (`<audio>` / `<video>` with `preload="none"`, and a download link). They come through the same authorized, audited attachment route as photos, inline only for types EstateOS's content check found: Ogg, MP3, M4A and WAV audio, and MP4 video (`INLINE_TYPES` in `src/modules/inbox/attachments.ts`).
- **Shared locations:** a card with the place, its address, the coordinates and **Open in Maps**. The Google Maps link carries the coordinates only.
- **Shared contacts:** up to 5, each with its numbers and emails, and **Create lead**, which opens the new-lead form prefilled with the name and number (`/leads/new?name=…&phone=…`, both checked on the server).
- **Reactions** show as text ("Reacted 👍 to a message"). Stickers already showed as images.
- **Data:**
  - `InboxMessage.detailsJson` (bounded JSON, validated when parsed and again before it is shown) and the message types `LOCATION` and `CONTACTS`, appended;
  - retention clears the details with the text;
  - the rules are in `src/modules/inbox/message-details.ts`, pure and unit-tested.

## Goal

Agents can **send** property photos, floor plans, brochures, documents and short videos on WhatsApp, from their computer or straight from the property's own media in EstateOS. They can also use **templates with an image, video or document at the top**, for example a new launch's photo with its message. Media customers send (voice notes, videos, locations) can be **played or seen in the inbox**, not only downloaded.

## What exists today (after 7B.2)

| Area | Today | Gap |
| --- | --- | --- |
| Media customers send | Photos and documents are downloaded after the webhook, checked by content and size (25 MB), stored privately and audited. Photos show in the chat. Voice notes, audio and video are accepted but **download only**. | No player for voice notes or video. **Locations**, contacts and stickers show as "unsupported". |
| Replies | Text inside the 24-hour window, and approved templates (text header, body, footer, static buttons) at any time. Drafting, approval and sending all go through `OutboundMessageJob`. | **No media can be sent.** Templates with an image, video or document header are listed as "not supported yet". |
| Property media | `InventoryMedia`: property photos, floor plans, brochures and documents in private storage. | Not reachable from the inbox. |

## Design

### 1. Seeing what customers send (7G.1)
- **Voice notes and audio:** a player in the chat bubble. Video gets a player too, with a download link.
- **Locations:** a pin card with the place's name, its address when Meta gives one, and **Open in Maps**. Coordinates are bounded and shown as text, and the link is to Google Maps.
- **Stickers** show as small images. **Shared contacts** show their name and number, with a button to start a lead from them.
- **Same protections as photos:** files come through the authorized, audited attachment route (inline, `nosniff`, `no-store`, a sandbox policy), and only after the content check.

### 2. Sending photos, documents and video (7G.2)
- **In the reply box, inside the 24-hour window:** **Attach** opens a choice:
  - **From this computer:** upload a file;
  - **From the property:** the photos, floor plans and brochures of the conversation's linked lead's property interests, or of any property the member can access.
- **One file per message, with an optional caption** (Meta allows one file per message). Several files become several messages, sent in order.
- **Meta's limits are checked before anything is drafted:**

  | Type | Formats | Size |
  | --- | --- | --- |
  | Image | JPEG, PNG | 5 MB |
  | Video | MP4 (H.264 video, AAC audio) | 16 MB |
  | Document | PDF, Word, Excel, PowerPoint | 25 MB (EstateOS's own cap; Meta allows 100 MB) |

  Captions stay within 1,024 characters. Every file is checked by content, so a renamed program is refused.
- **The same rules as text replies:**
  - opt-outs and the do-not-contact list;
  - the 24-hour window (outside it, use a template, see 3);
  - **approval when the company requires it**, with the approver seeing the file itself before approving;
  - test recipients until the owner switches the channel to real customers;
  - the per-minute and daily limits.
- **Sending:** the server uploads the file to Meta (`POST /{phone-number-id}/media`) with the channel's token, then sends it as an image, video or document message with its caption. The sent message keeps the file in the thread, like received media.
- **Uploaded files** are stored privately with the reply. Deleting an unsent reply deletes its file. Files picked from a property are **copied** into the inbox store, so later changes to the property don't change what was sent.

### 3. Templates with an image, video or document header (7G.3)
- **Choosing the header file:** templates whose header is an image, video or document become sendable. The member picks the header file, from the computer or the property, as in 2. The preview shows it above the text, as WhatsApp will.
- **Sending:** the file is uploaded to Meta when the reply is sent, and passed as the header parameter. The usual checks still apply: the template is re-read from Meta and must be unchanged, blanks are filled, and the daily template cap counts it.
- **Templates with media headers are often marketing templates,** which Meta charges for. The confirmation says so, as it does for any template today.

### 4. Security and privacy
- Files are untrusted:
  - checked by content and size;
  - stored only in the company's private storage path, never at a public URL;
  - every view and download is audited.
- Only members who can see the conversation can attach, see or approve its files. Property media can be attached only if the member may access that property.
- Files and their Meta media IDs are never logged. Tokens stay on the server.
- Inbox retention also removes sent files after the company's retention period.

### 5. Data (additive; needs a staging database deploy, with approval)
- `OutboundAttachment`: a reply's file (storage path, type, size, caption, its source: an upload or a property media item, and the Meta media ID once uploaded).
- New attachment kinds on `InboxAttachment` for locations and contacts, or a small `InboxMessage` metadata field. Decided while building, whichever stays simplest.
- Updated draft, approve and send operations; no change to existing rows.

## Build steps (each tested, then shown to you)
1. **7G.1 Seeing media:** players for voice notes, audio and video; location, sticker and contact cards. Unit and browser tests with the fake Meta server.
2. **7G.2 Sending media:**
   - **Attach** in the reply box, from the computer or the property;
   - Meta's limits and content checks;
   - approval with a preview;
   - upload to Meta and send;
   - the sent file shown in the thread;
   - database, unit and browser tests.
3. **7G.3 Media header templates:** the header file picker, the preview, and sending.
4. **7G.4 Staging:** the deploy, then a live test with the staging test number: receive a voice note and a location, send a photo and a brochure, and send a template with an image header.

## Not in 7G
- **Recording voice notes in the browser:** sending audio files is possible, but recording needs microphone permission and conversion.
- **Media in email replies:** email attachments are a separate step.
- **Several files in one message, and image editing:** WhatsApp doesn't support the first; the second isn't planned.
- **Interactive messages** (lists, reply buttons sent by EstateOS) and WhatsApp Flows.

## Decisions for you
1. **Attach from the property's media** as well as from the computer? Recommended: **yes**. It's the quickest way for an agent to send a brochure or floor plan, and only properties the member may access are offered.
2. **Document size cap:** recommended: **25 MB**, the same as received files (Meta allows 100 MB).
3. **Video:** recommended: **allow MP4 up to 16 MB**. EstateOS doesn't convert video; if Meta refuses a file's encoding, the reason is shown under the message.
4. **Approval:** recommended: **media replies follow the company's approval setting**, like text, with the approver seeing the file.
5. **Recording voice notes in the browser:** recommended: **not in 7G**.
