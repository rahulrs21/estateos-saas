import { acceptInvitationInputSchema } from "./server/validation";

/** The secret stays in the URL fragment, outside HTTP URLs and referrer headers. */
export function invitationLink(origin: string, input: unknown): string {
  const parsed = acceptInvitationInputSchema.parse(input);
  const url = new URL("/invite/accept", origin);
  url.hash = new URLSearchParams(parsed).toString();
  return url.toString();
}
export function parseInvitationFragment(fragment: string) {
  const params = new URLSearchParams(fragment.replace(/^#/, ""));
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    if (key in values) return null;
    values[key] = value;
  }
  const parsed = acceptInvitationInputSchema.safeParse(values);
  return parsed.success ? parsed.data : null;
}

/** Read pasted links locally; never navigate to an arbitrary supplied URL. */
export function parseInvitationUrl(value: string, origin: string) {
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== new URL(origin).origin ||
        url.pathname !== "/invite/accept" || url.search || url.username || url.password) return null;
    return parseInvitationFragment(url.hash);
  } catch { return null; }
}
