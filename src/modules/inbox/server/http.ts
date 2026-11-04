import "server-only";

import { read, write } from "@/modules/communications/server/http";
import {
  addNote, assignConversation, assignees, customerContext, getConversation, inboxCounts, inboxSettings, linkConversation, listConversations, listMessages, markRead, saveInboxSettings, setConversationState,
} from "./conversations";

/*
 * Inbox endpoints (docs/UNIFIED_INBOX.md#api). The same request policy as the
 * communication hub: reads need a verified session; changes also need
 * same-origin, the CSRF token and the company header matching the session's
 * company. The company always comes from the session.
 */

export const listConversationsResponse = (request: Request) => read(request, "inbox.list", listConversations);
export const countsResponse = (request: Request) => read(request, "inbox.counts", inboxCounts);
export const getConversationResponse = (request: Request, id: string) => read(request, "inbox.get", context => getConversation(context, id));
export const messagesResponse = (request: Request, id: string) => read(request, "inbox.messages", (context, query) => listMessages(context, id, query));
export const assigneesResponse = (request: Request) => read(request, "inbox.assignees", context => assignees(context));
export const assignResponse = (request: Request, id: string) => write(request, "inbox.assign", (context, body) => assignConversation(context, id, body));
export const stateResponse = (request: Request, id: string) => write(request, "inbox.state", (context, body) => setConversationState(context, id, body));
export const linkResponse = (request: Request, id: string) => write(request, "inbox.link", (context, body) => linkConversation(context, id, body));
export const noteResponse = (request: Request, id: string) => write(request, "inbox.note", (context, body) => addNote(context, id, body), 201);
export const readMarkResponse = (request: Request, id: string) => write(request, "inbox.read", context => markRead(context, id));
export const settingsResponse = (request: Request) => read(request, "inbox.settings", context => inboxSettings(context));
export const saveSettingsResponse = (request: Request) => write(request, "inbox.settings.save", saveInboxSettings);
export const customerResponse = (request: Request, id: string) => read(request, "inbox.customer", context => customerContext(context, id));
