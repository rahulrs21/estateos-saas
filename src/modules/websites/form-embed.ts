/*
 * Connecting a lead form by pasting it (docs/AI_PAGE_BUILDER.md#lead-form-and-contact-details).
 * Settings → Website lead forms offers a form's link ("Copy URL") and an embed
 * code ("Copy embed", an iframe). Pasting either into the page editor connects
 * that form to the page. Only the form's public ID is read: the pasted text is
 * never stored or rendered, so it cannot carry markup or scripts onto a page.
 */

const PUBLIC_ID = /^[A-Za-z0-9_-]{32,64}$/;

/** The public ID of an EstateOS lead form in a pasted link, embed code or bare ID; null when there is none. */
export function formPublicIdFrom(pasted: string): string | null {
  const text = pasted.trim().slice(0, 4000);
  if (PUBLIC_ID.test(text)) return text;
  // A hosted form link or an iframe src: …/forms/{publicId}, ended by a quote, a query, a fragment, a slash or the end.
  const ids = [...text.matchAll(/\/forms\/([A-Za-z0-9_-]{32,64})(?=["'?#\s/>&]|$)/g)].map(match => match[1]);
  const distinct = [...new Set(ids)];
  // Two different forms in one paste is ambiguous: none is chosen.
  return distinct.length === 1 ? distinct[0] : null;
}
