"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CaptureFieldKey } from "../validation";

type PublicForm = {
  publicId: string; name: string;
  fields: { key: CaptureFieldKey; label: string; enabled: boolean; required: boolean }[];
  consentText: string; privacyPolicyUrl: string; successMessage: string;
};

const fieldNames: Record<CaptureFieldKey, string> = {
  FULL_NAME: "fullName", EMAIL: "email", PHONE: "phone", MESSAGE: "message",
  PROPERTY_INTEREST: "propertyInterest", PREFERRED_LOCATION: "preferredLocation", PROPERTY_TYPE: "propertyType",
  TRANSACTION_TYPE: "transactionType", BUDGET_MIN: "budgetMin", BUDGET_MAX: "budgetMax", BEDROOM_PREFERENCE: "bedroomPreference",
};

export function PublicLeadForm({ form }: { form: PublicForm }) {
  const prefix = useId();
  const startedAt = useRef(0);
  const idempotencyKey = useRef("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [completed, setCompleted] = useState(false);

  useEffect(() => { startedAt.current = Date.now(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || completed) return;
    setPending(true); setMessage("");
    try {
      const data = new FormData(event.currentTarget);
      const values: Record<string, string | number> = {};
      for (const field of form.fields) {
        if (!field.enabled) continue;
        const value = String(data.get(fieldNames[field.key]) ?? "").trim();
        if (!value && !field.required) continue;
        values[field.key] = field.key === "BUDGET_MIN" || field.key === "BUDGET_MAX" ? Number(value) : value;
      }
      const referrer = document.referrer;
      const landing = referrer || window.location.href;
      const landingUrl = new URL(landing, window.location.href);
      const formUrl = new URL(window.location.href);
      const pick = (key: string) => landingUrl.searchParams.get(key) || formUrl.searchParams.get(key) || undefined;
      idempotencyKey.current ||= crypto.randomUUID().replaceAll("-", "");
      const response = await fetch(`/api/public/lead-forms/${encodeURIComponent(form.publicId)}`, {
        method: "POST", credentials: "omit", cache: "no-store",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.current },
        body: JSON.stringify({
          fields: values, consent: data.get("consent") === "on", honeypot: String(data.get("companyWebsite") ?? ""),
          elapsedMs: startedAt.current ? Math.max(0, Date.now() - startedAt.current) : 0,
          attribution: { landingPageUrl: landing, utmSource: pick("utm_source"), utmMedium: pick("utm_medium"), utmCampaign: pick("utm_campaign"), utmContent: pick("utm_content"), utmTerm: pick("utm_term") },
        }),
      });
      const result = await response.json() as { data?: { message?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "We couldn’t send your inquiry. Please try again.");
      setCompleted(true);
      setMessage(result.data?.message || form.successMessage);
      idempotencyKey.current = "";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn’t send your inquiry. Please try again.");
    } finally { setPending(false); }
  }

  function renderField(field: PublicForm["fields"][number]) {
    const id = `${prefix}-${field.key.toLowerCase()}`;
    const name = fieldNames[field.key];
    const common = { id, name, required: field.required, "aria-required": field.required, className: "h-10 bg-background", autoComplete: field.key === "FULL_NAME" ? "name" : field.key === "EMAIL" ? "email" : field.key === "PHONE" ? "tel" : undefined };
    if (field.key === "MESSAGE" || field.key === "PROPERTY_INTEREST") return <div key={field.key} className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label><textarea {...common} className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" maxLength={field.key === "MESSAGE" ? 4000 : 500} /></div>;
    if (field.key === "TRANSACTION_TYPE") return <div key={field.key} className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label><select {...common} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Choose one</option><option value="BUY">Buy</option><option value="RENT">Rent</option><option value="INVEST">Invest</option></select></div>;
    const type = field.key === "EMAIL" ? "email" : field.key === "PHONE" ? "tel" : field.key.startsWith("BUDGET") ? "number" : "text";
    return <div key={field.key} className="space-y-2"><label htmlFor={id} className="text-sm font-medium">{field.label}{field.required ? " *" : ""}</label><Input {...common} type={type} maxLength={field.key === "FULL_NAME" ? 160 : field.key === "EMAIL" ? 254 : field.key === "PHONE" ? 32 : 160} min={type === "number" ? 0 : undefined} step={type === "number" ? 1 : undefined} /></div>;
  }

  const visibleFields = form.fields.filter((field) => field.enabled);
  return <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6">
    <section className="mx-auto w-full max-w-2xl rounded-2xl border bg-card p-5 shadow-sm sm:p-8" aria-labelledby={`${prefix}-title`}>
      <div className="mb-7 border-b pb-5"><p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">EstateOS · Secure inquiry</p><h1 id={`${prefix}-title`} className="mt-3 text-2xl font-semibold tracking-tight">{form.name}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Share your details and the agency team will follow up with you.</p></div>
      {completed ? <div role="status" className="rounded-xl border border-primary/30 bg-primary/5 p-5 text-sm leading-6">{message}</div> : <form className="space-y-5" onSubmit={submit} aria-busy={pending}>
        <div className="grid gap-4 sm:grid-cols-2">{visibleFields.map(renderField)}</div>
        <div className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true"><label htmlFor={`${prefix}-company-website`}>Company website</label><input id={`${prefix}-company-website`} name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" /></div>
        <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-3 text-sm leading-5"><input className="mt-1 size-4 accent-primary" type="checkbox" name="consent" required /><span>{form.consentText} <a href={form.privacyPolicyUrl} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">Privacy policy</a></span></label>
        {message && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{message}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}Send inquiry</Button>
        <p className="text-center text-xs text-muted-foreground">Your information is sent to the agency that published this form.</p>
      </form>}
    </section>
    <footer className="mx-auto mt-5 max-w-2xl text-center text-xs text-muted-foreground">Powered by EstateOS</footer>
  </main>;
}

