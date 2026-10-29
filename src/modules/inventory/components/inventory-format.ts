export function safeExternalUrl(value?: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (!(url.protocol === "https:" || url.protocol === "http:") || url.username || url.password) return undefined;
    return url.toString();
  } catch { return undefined; }
}

export function humanizeInventoryValue(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Not set";
}
