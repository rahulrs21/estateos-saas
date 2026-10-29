import type { RateLimitCheck, RateLimitRule } from "../../lib/rate-limit/limiter";
import type { MapLookupOperation } from "./validation";

/**
 * Limits for paid Google lookups and map-pin reads. Autocomplete runs on
 * keystrokes (debounced in the browser), so it gets a larger budget than place
 * details and geocoding, which are counted together. Company-wide hourly
 * budgets cap the cost one tenant can generate; Google Cloud quotas remain the
 * hard ceiling.
 */
export const mapRateLimitRules = {
  autocompleteMember: {scope: "maps.autocomplete.member", limit: 60, windowSeconds: 60},
  autocompleteIp: {scope: "maps.autocomplete.ip", limit: 120, windowSeconds: 60},
  autocompleteCompany: {scope: "maps.autocomplete.company", limit: 2000, windowSeconds: 3600},
  geocodeMember: {scope: "maps.geocode.member", limit: 30, windowSeconds: 60},
  geocodeIp: {scope: "maps.geocode.ip", limit: 60, windowSeconds: 60},
  geocodeCompany: {scope: "maps.geocode.company", limit: 600, windowSeconds: 3600},
  pinsMember: {scope: "maps.pins.member", limit: 120, windowSeconds: 60},
  pinsIp: {scope: "maps.pins.ip", limit: 240, windowSeconds: 60},
} as const satisfies Record<string, RateLimitRule>;

type Subjects = {membershipId: string; organizationId: string; clientIp: string | null};

export function mapLookupRateLimitChecks(operation: MapLookupOperation, {membershipId, organizationId, clientIp}: Subjects): RateLimitCheck[] {
  const rules = mapRateLimitRules;
  const [member, ip, company] = operation === "autocomplete"
    ? [rules.autocompleteMember, rules.autocompleteIp, rules.autocompleteCompany]
    : [rules.geocodeMember, rules.geocodeIp, rules.geocodeCompany];
  return [
    {rule: member, subject: membershipId},
    {rule: ip, subject: clientIp ?? ""},
    {rule: company, subject: organizationId},
  ];
}

export function mapPinRateLimitChecks({membershipId, clientIp}: Omit<Subjects, "organizationId">): RateLimitCheck[] {
  return [
    {rule: mapRateLimitRules.pinsMember, subject: membershipId},
    {rule: mapRateLimitRules.pinsIp, subject: clientIp ?? ""},
  ];
}
