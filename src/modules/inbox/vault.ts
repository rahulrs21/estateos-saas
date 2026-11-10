import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/*
 * Encryption for mailbox OAuth grants (docs/INBOX_SECURITY.md#credentials).
 * AES-256-GCM with a random 96-bit IV per write. The additional authenticated
 * data binds a ciphertext to its purpose, company and connection, so a value
 * copied to another row (or used for another purpose) fails to decrypt. The key
 * lives only in the server environment (INBOX_TOKEN_ENCRYPTION_KEY, 32 bytes in
 * base64); without it nothing is stored. Stored form: "v1:<iv>:<tag>:<ciphertext>"
 * (base64url), with the key ID kept beside it for rotation.
 */

export const TOKEN_KEY_ID = "k1";
const KEY_VARIABLE = "INBOX_TOKEN_ENCRYPTION_KEY";

export class TokenVaultError extends Error {
  constructor(public readonly code: "NO_KEY" | "UNREADABLE", message: string) { super(message); this.name = "TokenVaultError"; }
}

/** The key, or null when the server has none (or a malformed one). */
export function vaultKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env[KEY_VARIABLE]?.trim();
  if (!raw || !/^[A-Za-z0-9+/_-]{43}=?$/.test(raw)) return null;
  const key = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  return key.length === 32 ? key : null;
}
export const vaultConfigured = () => vaultKey() !== null;

export interface VaultBinding { purpose: string; organizationId: string; recordId: string }
const aad = (binding: VaultBinding) => Buffer.from(`estateos.inbox.${binding.purpose}|${binding.organizationId.toLowerCase()}|${binding.recordId.toLowerCase()}`, "utf8");

export function sealSecret(plaintext: string, binding: VaultBinding, key = vaultKey()): {ciphertext: string; keyId: string} {
  if (!key) throw new TokenVaultError("NO_KEY", `The server has no ${KEY_VARIABLE}. Add a 32-byte key (base64) to the server environment before connecting a mailbox.`);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv, {authTagLength: 16});
  cipher.setAAD(aad(binding));
  const sealed = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {ciphertext: ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), sealed.toString("base64url")].join(":"), keyId: TOKEN_KEY_ID};
}

/** The plaintext, only if the value is intact, sealed with this key and bound to this record. */
export function openSecret(stored: string | null | undefined, keyId: string | null | undefined, binding: VaultBinding, key = vaultKey()): string {
  if (!key) throw new TokenVaultError("NO_KEY", `The server has no ${KEY_VARIABLE}.`);
  const parts = (stored ?? "").split(":");
  if (keyId !== TOKEN_KEY_ID || parts.length !== 4 || parts[0] !== "v1") throw new TokenVaultError("UNREADABLE", "The stored grant cannot be read.");
  try {
    const iv = Buffer.from(parts[1], "base64url"), tag = Buffer.from(parts[2], "base64url");
    // A full 16-byte tag only: a shortened tag would weaken the integrity check.
    if (iv.length !== 12 || tag.length !== 16) throw new Error("malformed");
    const decipher = createDecipheriv("aes-256-gcm", key, iv, {authTagLength: 16});
    decipher.setAAD(aad(binding));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new TokenVaultError("UNREADABLE", "The stored grant cannot be read.");
  }
}
