import { z } from "zod";

export const captureFieldKeys = [
  "FULL_NAME", "EMAIL", "PHONE", "MESSAGE", "PROPERTY_INTEREST",
  "PREFERRED_LOCATION", "PROPERTY_TYPE", "TRANSACTION_TYPE", "BUDGET_MIN",
  "BUDGET_MAX", "BEDROOM_PREFERENCE",
] as const;
export type CaptureFieldKey = (typeof captureFieldKeys)[number];

export const captureFieldSchema = z.strictObject({
  key: z.enum(captureFieldKeys),
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  required: z.boolean(),
});

export const captureFormSchema = z.strictObject({
  name: z.string().trim().min(2).max(120),
  status: z.enum(["DRAFT", "ACTIVE", "DISABLED"]),
  branchId: z.uuid().nullable().optional(),
  projectId: z.uuid().nullable().optional(),
  fields: z.array(captureFieldSchema).min(3).max(captureFieldKeys.length),
  consentText: z.string().trim().min(1).max(1000),
  privacyPolicyUrl: z.url().max(2048).refine((value) => new URL(value).protocol === "https:", "Use an HTTPS privacy policy URL."),
  successMessage: z.string().trim().min(1).max(240),
}).superRefine((form, context) => {
  const keys = form.fields.map((field) => field.key);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: "custom", path: ["fields"], message: "Each field can appear only once." });
  const name = form.fields.find((field) => field.key === "FULL_NAME");
  if (!name?.enabled || !name.required) context.addIssue({ code: "custom", path: ["fields"], message: "Full name must be enabled and required." });
  if (!form.fields.some((field) => ["EMAIL", "PHONE"].includes(field.key) && field.enabled)) {
    context.addIssue({ code: "custom", path: ["fields"], message: "Enable at least one contact method: email or phone." });
  }
  if (form.fields.some((field) => field.required && !field.enabled)) context.addIssue({ code: "custom", path: ["fields"], message: "Disabled fields cannot be required." });
  if (form.status === "ACTIVE" && form.consentText.length < 8) context.addIssue({ code: "custom", path: ["consentText"], message: "Add a clear consent notice before publishing." });
});

export type CaptureFormInput = z.infer<typeof captureFormSchema>;

export const defaultCaptureFields: CaptureFormInput["fields"] = [
  { key: "FULL_NAME", label: "Full name", enabled: true, required: true },
  { key: "EMAIL", label: "Email address", enabled: true, required: false },
  { key: "PHONE", label: "Phone number", enabled: true, required: false },
  { key: "MESSAGE", label: "How can we help?", enabled: true, required: false },
  { key: "PROPERTY_INTEREST", label: "What are you looking for?", enabled: false, required: false },
  { key: "PREFERRED_LOCATION", label: "Preferred location", enabled: false, required: false },
  { key: "PROPERTY_TYPE", label: "Property type", enabled: false, required: false },
  { key: "TRANSACTION_TYPE", label: "I am interested to", enabled: false, required: false },
  { key: "BUDGET_MIN", label: "Minimum budget (AED)", enabled: false, required: false },
  { key: "BUDGET_MAX", label: "Maximum budget (AED)", enabled: false, required: false },
  { key: "BEDROOM_PREFERENCE", label: "Bedrooms", enabled: false, required: false },
];

const baseSubmissionSchema = z.strictObject({
  fields: z.record(z.string(), z.unknown()),
  consent: z.literal(true),
  honeypot: z.string().max(200).default(""),
  elapsedMs: z.number().int().min(0).max(3_600_000),
  attribution: z.strictObject({
    landingPageUrl: z.string().max(2048).optional(),
    utmSource: z.string().max(200).optional(),
    utmMedium: z.string().max(200).optional(),
    utmCampaign: z.string().max(200).optional(),
    utmContent: z.string().max(200).optional(),
    utmTerm: z.string().max(200).optional(),
  }).default({}),
});

const configuredValueSchemas: Record<CaptureFieldKey, z.ZodType> = {
  FULL_NAME: z.string().trim().min(2).max(160),
  EMAIL: z.union([z.string().trim().max(254).email(), z.literal("")]),
  PHONE: z.union([z.string().trim().min(6).max(32).regex(/^\+?[0-9 ()-]+$/), z.literal("")]),
  MESSAGE: z.string().trim().max(4000),
  PROPERTY_INTEREST: z.string().trim().max(500),
  PREFERRED_LOCATION: z.string().trim().max(160),
  PROPERTY_TYPE: z.string().trim().max(80),
  TRANSACTION_TYPE: z.enum(["BUY", "RENT", "INVEST"]),
  BUDGET_MIN: z.coerce.number().finite().min(0).max(1_000_000_000_000),
  BUDGET_MAX: z.coerce.number().finite().min(0).max(1_000_000_000_000),
  BEDROOM_PREFERENCE: z.string().trim().max(40),
};

export function parsePublicSubmission(configuredFields: unknown, input: unknown) {
  const config = z.array(captureFieldSchema).safeParse(configuredFields);
  const base = baseSubmissionSchema.safeParse(input);
  if (!config.success || !base.success) return null;

  const enabled = config.data.filter((field) => field.enabled);
  const shape = Object.fromEntries(enabled.map((field) => {
    const schema = field.key === "EMAIL"
      ? (field.required ? z.string().trim().max(254).email() : configuredValueSchemas.EMAIL.optional())
      : field.key === "PHONE"
        ? (field.required ? z.string().trim().min(6).max(32).regex(/^\+?[0-9 ()-]+$/) : configuredValueSchemas.PHONE.optional())
        : configuredValueSchemas[field.key];
    return [field.key, field.required ? schema : schema.optional()];
  }));
  const parsed = z.strictObject(shape).safeParse(base.data.fields);
  if (!parsed.success) return null;
  const fields = parsed.data as Partial<Record<CaptureFieldKey, unknown>>;
  const email = typeof fields.EMAIL === "string" && fields.EMAIL ? fields.EMAIL.trim() : undefined;
  const phone = typeof fields.PHONE === "string" && fields.PHONE ? fields.PHONE.trim() : undefined;
  if (!email && !phone) return null;
  if (typeof fields.BUDGET_MIN === "number" && typeof fields.BUDGET_MAX === "number" && fields.BUDGET_MAX < fields.BUDGET_MIN) return null;
  if (base.data.honeypot.trim() || base.data.elapsedMs < 900) return null;
  const attribution = base.data.attribution;
  let landingPageUrl: string | undefined;
  if (attribution.landingPageUrl) {
    try {
      const url = new URL(attribution.landingPageUrl);
      if (url.protocol === "https:" || url.protocol === "http:") {
        url.username = "";
        url.password = "";
        url.search = "";
        url.hash = "";
        landingPageUrl = url.toString().slice(0, 2048);
      }
    } catch { /* Untrusted attribution is discarded, never blocks valid capture. */ }
  }
  const safeUtm = (value: string | undefined) => value?.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 200) || undefined;
  return {
    fields: parsed.data as Record<CaptureFieldKey, unknown>,
    fullName: fields.FULL_NAME as string,
    email: email?.toLowerCase() ?? null,
    phone: phone ?? null,
    message: (fields.MESSAGE as string | undefined) || null,
    propertyInterest: (fields.PROPERTY_INTEREST as string | undefined) || null,
    preferredLocation: (fields.PREFERRED_LOCATION as string | undefined) || null,
    propertyType: (fields.PROPERTY_TYPE as string | undefined) || null,
    transactionType: (fields.TRANSACTION_TYPE as "BUY" | "RENT" | "INVEST" | undefined) ?? null,
    budgetMin: typeof fields.BUDGET_MIN === "number" ? fields.BUDGET_MIN : null,
    budgetMax: typeof fields.BUDGET_MAX === "number" ? fields.BUDGET_MAX : null,
    bedroomPreference: (fields.BEDROOM_PREFERENCE as string | undefined) || null,
    attribution: {
      landingPageUrl,
      utmSource: safeUtm(attribution.utmSource),
      utmMedium: safeUtm(attribution.utmMedium),
      utmCampaign: safeUtm(attribution.utmCampaign),
      utmContent: safeUtm(attribution.utmContent),
      utmTerm: safeUtm(attribution.utmTerm) ?? "",
    },
  };
}
