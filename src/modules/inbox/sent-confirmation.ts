/*
 * Confirming an email reply whose send was not answered in time
 * (docs/EMAIL_INTEGRATION_PLAN.md#sending). A provider can finish sending
 * after EstateOS stopped waiting, so an unanswered send is not reported as
 * failed straight away: the mailbox's Sent folder is checked for that exact
 * reply first. Pure rules, kept free of server imports for unit tests.
 */

/** A send that ended without an answer: the provider may still have sent it. */
export const uncertainSend = (code: string) => code === "TIMEOUT" || code === "NETWORK";

/** How long a reply send may take before EstateOS stops waiting (other provider calls keep their shorter limit). */
export const SEND_TIMEOUT_MS = 30_000;

/** The pauses before each look in the Sent folder (about 12 seconds in all). */
export const SENT_CHECK_DELAYS_MS = [2_000, 4_000, 6_000] as const;

const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Looks for the reply after each pause; the first match wins. A failed look is retried, never fatal. */
export async function confirmSent<T>(lookup: () => Promise<T | null>, delays: readonly number[] = SENT_CHECK_DELAYS_MS, wait: (ms: number) => Promise<void> = pause): Promise<T | null> {
  for (const delay of delays) {
    await wait(delay);
    try {
      const found = await lookup();
      if (found) return found;
    } catch { /* look again after the next pause */ }
  }
  return null;
}

export interface OutlookSentItem { id?: string; sentDateTime?: string; toRecipients?: Array<{emailAddress?: {address?: string}}> }

/**
 * The Outlook Sent Items message that is this reply: in the same conversation (the
 * caller lists only that conversation), to the customer, and sent since the attempt
 * began. Outlook's reply action returns no message ID, so this is how it is found.
 */
export function matchOutlookSentReply(items: OutlookSentItem[], input: {since: string; to: string}): string | null {
  const since = Date.parse(input.since);
  const to = input.to.trim().toLowerCase();
  if (!Number.isFinite(since) || !to) return null;
  const match = items.find(item => typeof item.id === "string" && item.id.length > 0 && typeof item.sentDateTime === "string" && Date.parse(item.sentDateTime) >= since
    && (item.toRecipients ?? []).some(recipient => recipient.emailAddress?.address?.trim().toLowerCase() === to));
  return match?.id ?? null;
}
