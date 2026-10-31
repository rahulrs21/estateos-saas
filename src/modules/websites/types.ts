import type { CaptureFieldKey } from "../lead-capture/validation";
import type { LinkedData } from "./linked";
import type { PageData } from "./registry";

/** The connected Phase 4 lead form as a page may show it: enabled fields, consent and privacy notice only. */
export interface PageFormView {
  fields: Array<{key: CaptureFieldKey; label: string; required: boolean}>;
  consentText: string;
  privacyPolicyUrl: string;
  successMessage: string;
}

export type RenderMode = "editor" | "preview" | "public";

export interface RenderablePage {
  title: string;
  data: PageData;
  linked: LinkedData;
  form: PageFormView | null;
}

/** Where a public page sends enquiries; null in the editor and in previews, which never submit. */
export interface PublicPageContext { enquiryEndpoint: string; pageTitle: string }

export function presentFormView(form: {fields: unknown; consentText: string; privacyPolicyUrl: string; successMessage: string} | null | undefined, status?: string | null): PageFormView | null {
  if (!form || (status && status !== "ACTIVE")) return null;
  const fields = Array.isArray(form.fields) ? form.fields as Array<{key: CaptureFieldKey; label: string; enabled: boolean; required: boolean}> : [];
  return {
    fields: fields.filter(field => field.enabled).map(field => ({key: field.key, label: String(field.label).slice(0, 80), required: Boolean(field.required)})),
    consentText: form.consentText, privacyPolicyUrl: form.privacyPolicyUrl, successMessage: form.successMessage,
  };
}
