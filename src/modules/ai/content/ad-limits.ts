/**
 * Advertising copy limits per platform. These are reference values, not a
 * statement that copy is compliant or approved: platforms change limits and
 * policies, so administrators can override any number with AI_AD_LIMITS (a
 * JSON object, see docs/AI_TEMPLATES.md) and must re-check copy in the ad
 * platform before publishing. `kind: "hard"` marks limits the platform
 * enforces; "recommended" marks lengths beyond which text is usually truncated.
 */

export const AD_PLATFORMS = ["META", "GOOGLE_SEARCH", "TIKTOK", "LINKEDIN"] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

export interface TextLimit { max: number; kind: "hard" | "recommended" }

export interface AdPlatformLimits {
  label: string;
  primaryText: TextLimit | null;
  headline: TextLimit | null;
  description: TextLimit | null;
  headlinesPerVariant: number;
  descriptionsPerVariant: number;
  variants: number;
  policyNotes: string[];
  /** Where the default values come from. Re-verify with the platform before relying on them. */
  reference: string;
}

const COMMON_POLICY = [
  "No guaranteed returns, yields or investment outcomes.",
  "Prices, availability and permit details must match the verified listing at the time of publication.",
  "Real estate ads may require a valid advertising permit (for example a Trakheesi permit in Dubai); EstateOS does not verify permits.",
];

export const DEFAULT_AD_LIMITS: Record<AdPlatform, AdPlatformLimits> = {
  META: {
    label: "Meta (Facebook and Instagram)",
    primaryText: {max: 125, kind: "recommended"}, headline: {max: 40, kind: "recommended"}, description: {max: 30, kind: "recommended"},
    headlinesPerVariant: 1, descriptionsPerVariant: 1, variants: 3,
    policyNotes: [...COMMON_POLICY, "Housing ads are a special ad category in some regions; targeting restrictions may apply."],
    reference: "Meta Ads Guide recommended text lengths",
  },
  GOOGLE_SEARCH: {
    label: "Google Search (responsive search ads)",
    primaryText: null, headline: {max: 30, kind: "hard"}, description: {max: 90, kind: "hard"},
    headlinesPerVariant: 5, descriptionsPerVariant: 2, variants: 2,
    policyNotes: [...COMMON_POLICY, "Avoid excessive capitalisation and punctuation in headlines."],
    reference: "Google Ads responsive search ad specifications",
  },
  TIKTOK: {
    label: "TikTok",
    primaryText: {max: 100, kind: "hard"}, headline: null, description: null,
    headlinesPerVariant: 0, descriptionsPerVariant: 0, variants: 3,
    policyNotes: [...COMMON_POLICY],
    reference: "TikTok Ads Manager ad text specification",
  },
  LINKEDIN: {
    label: "LinkedIn",
    primaryText: {max: 150, kind: "recommended"}, headline: {max: 70, kind: "recommended"}, description: {max: 100, kind: "recommended"},
    headlinesPerVariant: 1, descriptionsPerVariant: 1, variants: 3,
    policyNotes: [...COMMON_POLICY],
    reference: "LinkedIn single image ad specifications (recommended lengths)",
  },
};

export function isAdPlatform(value: string): value is AdPlatform {
  return (AD_PLATFORMS as readonly string[]).includes(value);
}

type Override = Partial<Record<"primaryText" | "headline" | "description", number>>;

/**
 * Apply AI_AD_LIMITS overrides, e.g. {"META":{"primaryText":150}}. Invalid
 * input is reported and ignored so a typo cannot silently remove a limit.
 */
export function resolveAdLimits(raw: string | undefined, problems: string[] = []): Record<AdPlatform, AdPlatformLimits> {
  const limits = structuredClone(DEFAULT_AD_LIMITS);
  if (!raw?.trim()) return limits;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { problems.push("AI_AD_LIMITS is not valid JSON."); return limits; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { problems.push("AI_AD_LIMITS must be a JSON object."); return limits; }
  for (const [platform, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isAdPlatform(platform) || !value || typeof value !== "object") { problems.push(`AI_AD_LIMITS has an unknown platform: ${platform.slice(0, 20)}.`); continue; }
    for (const [field, max] of Object.entries(value as Override)) {
      if (!["primaryText", "headline", "description"].includes(field) || !Number.isInteger(max) || (max as number) < 10 || (max as number) > 5000) {
        problems.push(`AI_AD_LIMITS.${platform}.${field.slice(0, 20)} must be a whole number from 10 to 5000.`);
        continue;
      }
      const key = field as keyof Override;
      const current = limits[platform][key];
      limits[platform][key] = {max: max as number, kind: current?.kind ?? "recommended"};
    }
  }
  return limits;
}
