import { z } from "zod";

export const emirates = {
  ABU_DHABI: "Abu Dhabi", DUBAI: "Dubai", SHARJAH: "Sharjah", AJMAN: "Ajman",
  UMM_AL_QUWAIN: "Umm Al Quwain", RAS_AL_KHAIMAH: "Ras Al Khaimah", FUJAIRAH: "Fujairah",
} as const;
export const companySizes = {
  SOLO: "Just me", TWO_TO_TEN: "2–10 people", ELEVEN_TO_FIFTY: "11–50 people",
  FIFTY_ONE_TO_TWO_HUNDRED: "51–200 people", TWO_HUNDRED_PLUS: "201+ people",
} as const;
export const organizationNameSchema = z.string().trim().min(2, "Enter at least 2 characters.").max(120);
export const organizationSlugSchema = z.string().trim().toLowerCase().min(3, "Use at least 3 characters.").max(63)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letters, numbers and single hyphens.");
export const companyDetailsSchema = z.strictObject({
  name: organizationNameSchema,
  slug: organizationSlugSchema,
  emirate: z.enum(Object.keys(emirates) as [keyof typeof emirates, ...(keyof typeof emirates)[]], { error: "Choose an emirate." }),
  contactPhone: z.string().trim().max(32).regex(/^\+?[0-9][0-9 ()-]{6,30}$/, "Enter a valid phone number, including country code."),
  companyEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid company email.").max(254)),
  companySize: z.enum(Object.keys(companySizes) as [keyof typeof companySizes, ...(keyof typeof companySizes)[]], { error: "Choose a company size." }),
});
export type CompanyDetails = z.infer<typeof companyDetailsSchema>;
