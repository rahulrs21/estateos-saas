/** SQL Connect may serialize UUIDs as 32 hex characters instead of dashed text. */
export function canonicalUuid(value: string): string {
  const normalized = value.toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) return normalized;
  return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}
