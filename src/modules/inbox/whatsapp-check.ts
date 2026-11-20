import { estateOsEnvironment } from "../../lib/environment/hosted-guard";

/*
 * Pure rules of the WhatsApp connection check (server/connections.ts), kept free of
 * server imports so they can be unit tested.
 */

/** Plain advice for Meta's usual refusals, shown after Meta's own code and message. */
export function metaCheckAdvice(code: string, step: "number" | "account" | "webhooks"): string {
  if (code === "190") return "The access token is not valid any more: generate a new system user token in Meta Business Settings and save it on the channel.";
  if (code === "100" && step === "number") return "Check the Phone number ID (Meta for Developers → your app → WhatsApp → API Setup).";
  if (code === "100") return "Meta cannot open this WhatsApp Business Account with the channel's token. Check that the ID is the WhatsApp Business Account ID (not the Phone number ID), and that the system user has Full control of it: in Meta Business Settings, open Messaging accounts → this account → Assign people → System users. Giving it only the phone number (under WhatsApp accounts) is not enough.";
  if (code === "200" || code === "10" || code === "3") return "The token is missing a permission: it needs whatsapp_business_management and whatsapp_business_messaging, and the system user needs Full control of the WhatsApp account.";
  if (code === "2200") return "Meta could not verify the webhook address: the server's Meta app secret or its verify token is missing or different.";
  return "";
}

/**
 * Whether Check connection also routes the WhatsApp account's webhooks to the channel (as Connect WhatsApp does). Only
 * hosted servers: local development keeps the Meta app's default webhook, so a live number used locally is not moved.
 */
export const routesAccountWebhooks = (env: Record<string, string | undefined>) => {
  const environment = estateOsEnvironment(env);
  return environment === "staging" || environment === "production";
};
