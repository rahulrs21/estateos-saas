"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { companyDetailsSchema, emirates, companySizes } from "../validation";
import type { CompanyRecord } from "../types";
import { companyRequest } from "../client";

const selectStyle = "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 aria-invalid:border-destructive";

function Field({ name, label, error, hint, children }: { name: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>{children}
    {(error || hint) && <p id={name + "-message"} className={error ? "text-xs text-destructive" : "text-xs leading-5 text-muted-foreground"}>{error || hint}</p>}
  </div>;
}

export function CompanyForm({ company, canEdit = true }: { company?: CompanyRecord; canEdit?: boolean }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [slug, setSlug] = useState(company?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(company));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !canEdit) return;
    setError(""); setSuccess(""); setErrors({});
    const fields = new FormData(event.currentTarget);
    const input = Object.fromEntries(["name", "slug", "emirate", "contactPhone", "companyEmail", "companySize"].map(key => [key, String(fields.get(key) ?? "")]));
    const result = companyDetailsSchema.safeParse(input);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setError("Review the highlighted fields and try again.");
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus());
      return;
    }
    setPending(true);
    try {
      await companyRequest(company ? "/api/organizations/current" : "/api/organizations", company ? "PATCH" : "POST", result.data, company?.id);
      setSuccess(company ? "Company details saved." : "Company created. Opening your dashboard…");
      if (company) router.refresh();
      // Clear the previous workspace's router cache and client component state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Tenant changes require a full document reload.
      else window.location.assign("/workspace/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your company could not be saved. Please try again.");
    } finally { setPending(false); }
  }

  const accessibility = (name: string) => ({
    "aria-invalid": Boolean(errors[name]),
    "aria-describedby": name === "slug" || name === "contactPhone" || errors[name] ? name + "-message" : undefined,
  });
  return <form ref={formRef} onSubmit={submit} noValidate aria-busy={pending} className="space-y-5">
    {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">{success}</p>}
    {!canEdit && <p role="note" className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Your company details are available below. An owner or administrator can update them.</p>}
    <Card className="gap-5 py-5 shadow-xs ring-border">
      <CardHeader className="px-5 sm:px-6"><CardTitle role="heading" aria-level={2}>Company details</CardTitle><CardDescription>{company ? "Keep your agency information up to date." : "Create the workspace your agency will call home. All fields are required."}</CardDescription></CardHeader>
      <CardContent className="px-5 sm:px-6">
        <fieldset disabled={pending || !canEdit} className="grid min-w-0 gap-5 sm:grid-cols-2">
          <legend className="sr-only">Company information</legend>
          <Field name="name" label="Company name" error={errors.name}><Input id="name" name="name" defaultValue={company?.name ?? ""} autoComplete="organization" required maxLength={120} className="h-10" {...accessibility("name")} onChange={event => {
            if (!slugEdited) setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63));
          }} /></Field>
          <Field name="slug" label="Company slug" error={errors.slug} hint="A unique workspace identifier. Use lowercase letters, numbers and hyphens."><Input id="slug" name="slug" value={slug} onChange={event => { setSlugEdited(true); setSlug(event.target.value); }} autoCapitalize="none" spellCheck={false} required maxLength={63} className="h-10" {...accessibility("slug")} /></Field>
          <Field name="emirate" label="Emirate" error={errors.emirate}><select id="emirate" name="emirate" defaultValue={company?.emirate ?? ""} required className={selectStyle} {...accessibility("emirate")}><option value="">Choose an emirate</option>{Object.entries(emirates).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field name="companySize" label="Company size" error={errors.companySize}><select id="companySize" name="companySize" defaultValue={company?.companySize ?? ""} required className={selectStyle} {...accessibility("companySize")}><option value="">Choose company size</option>{Object.entries(companySizes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field name="contactPhone" label="Contact phone" error={errors.contactPhone} hint="Include the country code, for example +971."><Input id="contactPhone" name="contactPhone" type="tel" defaultValue={company?.contactPhone ?? ""} autoComplete="tel" required maxLength={32} className="h-10" {...accessibility("contactPhone")} /></Field>
          <Field name="companyEmail" label="Company email" error={errors.companyEmail}><Input id="companyEmail" name="companyEmail" type="email" defaultValue={company?.companyEmail ?? ""} autoComplete="email" required maxLength={254} className="h-10" {...accessibility("companyEmail")} /></Field>
        </fieldset>
      </CardContent>
    </Card>
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm"><Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" /><div><p className="font-medium">Company logo</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Logo uploads will be available in a future update.</p></div></div>
    {canEdit && <div className="flex flex-wrap items-center justify-between gap-4"><p className="max-w-md text-xs leading-5 text-muted-foreground">{company ? "Changes apply to this company workspace." : "You will be the owner of your new company. Other companies and their records stay separate."}</p><Button type="submit" size="lg" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <ArrowRight aria-hidden="true" />}{pending ? "Saving…" : company ? "Save company details" : "Create company"}</Button></div>}
  </form>;
}
