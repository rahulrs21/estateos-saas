/*
 * Why WhatsApp did not deliver a message (Phase 7B.2). Meta accepts a message, then reports in a
 * receipt that it failed, with an error code; EstateOS stores it with the status ("failed:131042")
 * and shows the member what it means and what to do. Codes from Meta's Cloud API error reference.
 */

const REASONS: Record<string, string> = {
  "131042": "Meta reports a payment problem on the WhatsApp Business Account. Add a valid payment method in WhatsApp Manager (Account tools → Payment methods), then send again.",
  "131026": "WhatsApp could not deliver it to this number. The number may not be on WhatsApp, or the person has not accepted WhatsApp's latest terms.",
  "131047": "More than 24 hours have passed since the customer last wrote, so only an approved template can be sent.",
  "131049": "Meta chose not to deliver this message to keep the customer's experience healthy (often a limit on marketing messages). Try again later, or use a Utility template.",
  "131050": "The customer has stopped receiving marketing messages from your business.",
  "131051": "WhatsApp does not support this kind of message.",
  "131052": "The customer's file could not be downloaded from WhatsApp.",
  "131053": "The file could not be uploaded to WhatsApp.",
  "131056": "Too many messages were sent to this number in a short time. Wait a little, then try again.",
  "131031": "The WhatsApp Business Account is restricted or locked. Check its status in WhatsApp Manager.",
  "131045": "The phone number is not properly registered with WhatsApp. Check its status in WhatsApp Manager.",
  "131048": "Meta limited this number for spam. Check its quality rating in WhatsApp Manager.",
  "131000": "Something went wrong at Meta. Try again later.",
  "131016": "WhatsApp is temporarily unavailable. Try again later.",
  "132000": "The template's blanks do not match what Meta approved.",
  "132001": "This template does not exist in this language in your WhatsApp account.",
  "132005": "The filled template is too long.",
  "132007": "The template's text breaks Meta's formatting rules.",
  "132012": "The template's blanks were not in the format Meta expects.",
  "132015": "Meta has paused this template because of low quality.",
  "132016": "Meta has disabled this template.",
  "130472": "Meta held this message back as part of an experiment on this customer's account.",
  "368": "Meta has temporarily blocked this account for breaking its policies.",
  "470": "More than 24 hours have passed since the customer last wrote, so only an approved template can be sent.",
};

/** The Meta error code inside a stored status such as "failed:131042", or null. */
export function whatsappErrorCode(raw: string | null | undefined) {
  const match = /^failed:([0-9]{1,10})$/.exec(raw ?? "");
  return match ? match[1] : null;
}

/** What a failed WhatsApp message means for the member, or null when Meta gave no reason. */
export function whatsappFailureReason(raw: string | null | undefined) {
  const code = whatsappErrorCode(raw);
  if (!code) return null;
  return `${REASONS[code] ?? "Meta did not deliver it."} (WhatsApp error ${code})`;
}
