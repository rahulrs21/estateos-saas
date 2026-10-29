import type { PortalProviderCode } from "../types";
import { bayutAdapter } from "./bayut";
import type { PortalAdapter } from "./draft-adapter";
import { dubizzleAdapter } from "./dubizzle";
import { propertyFinderAdapter } from "./property-finder";

/** The provider catalog. Adding a portal means adding an adapter and an enum value. */
export const portalAdapters: Record<PortalProviderCode, PortalAdapter> = {
  PROPERTY_FINDER: propertyFinderAdapter,
  BAYUT: bayutAdapter,
  DUBIZZLE: dubizzleAdapter,
};

export function getPortalAdapter(provider: string): PortalAdapter {
  const adapter = portalAdapters[provider as PortalProviderCode];
  if (!adapter) throw new Error(`Unknown portal provider: ${provider}`);
  return adapter;
}

export type { PortalAdapter };
