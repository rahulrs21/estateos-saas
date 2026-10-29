import { isIP } from "node:net";

/**
 * Resolve the client IP for rate limiting without trusting spoofable headers.
 *
 * X-Forwarded-For is a comma-separated list that every proxy appends to, so
 * only the entries added by proxies we operate are trustworthy. With
 * `trustedProxyHops = N`, the client is the N-th entry from the right: the
 * address our outermost trusted proxy saw. Everything left of it was supplied
 * by the client and is ignored. With 0 hops (the default, e.g. local
 * development without a proxy) forwarded headers are ignored entirely and the
 * caller gets null, so per-IP limits are skipped rather than keyed on a value an
 * attacker controls.
 *
 * Firebase App Hosting (Cloud Run behind Google's load balancer) needs 1 hop.
 */
export function clientIpFromHeaders(headers: Headers, trustedProxyHops: number): string | null {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 1) return null;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;
  const entries = forwarded.split(",").map(entry => entry.trim()).filter(Boolean);
  if (entries.length < trustedProxyHops) return null;
  return normalizeIp(entries[entries.length - trustedProxyHops]);
}

/**
 * Normalize to a stable subject: IPv4-mapped IPv6 becomes IPv4, and IPv6
 * addresses are grouped by /64 because one client usually controls a whole /64.
 */
export function normalizeIp(value: string): string | null {
  let candidate = value.trim();
  if (candidate.startsWith("[")) candidate = candidate.slice(1, candidate.indexOf("]"));
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(candidate)) candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(candidate);
  if (mapped) candidate = mapped[1];
  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version !== 6) return null;
  return `${expandIpv6(candidate).slice(0, 4).join(":")}::/64`;
}

function expandIpv6(address: string) {
  const withoutZone = address.split("%")[0].toLowerCase();
  const [head, tail = ""] = withoutZone.split("::");
  const left = head ? head.split(":") : [];
  const right = withoutZone.includes("::") && tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  return [...left, ...Array(Math.max(0, missing)).fill("0"), ...right].map(group => group.replace(/^0+(?=.)/, ""));
}

export function trustedProxyHopsFromEnv(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const hops = Number(value);
  if (!Number.isInteger(hops) || hops < 0 || hops > 5) throw new Error("RATE_LIMIT_TRUSTED_PROXY_HOPS must be an integer from 0 to 5.");
  return hops;
}
