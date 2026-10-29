"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { developerInputSchema, projectInputSchema } from "../validation";
import { LocationFields } from "@/modules/maps/components/location-fields";

type Company = {id: string; name: string; role: string};
type DeveloperRecord = {
  id?: string; name: string; slug: string; logoReference?: string | null; description?: string | null;
  website?: string | null; email?: string | null; phone?: string | null; country: string;
  headOfficeAddress?: string | null; headOfficeLatitude?: number | null; headOfficeLongitude?: number | null;
  headOfficeGooglePlaceId?: string | null; status: "ACTIVE" | "INACTIVE";
};
type ProjectRecord = {
  id?: string; developerId: string; projectName: string; projectCode: string; description?: string | null;
  projectType: string; ownershipType?: string | null; community?: string | null; area?: string | null;
  emirate?: string | null; country: string; address?: string | null; latitude?: number | null; longitude?: number | null;
  city?: string | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
  launchDate?: string | null; expectedHandoverDate?: string | null; actualHandoverDate?: string | null;
  constructionStatus: string; projectStatus: string; startingPriceMinor?: string | null; currency: string;
  totalUnits?: number | null; marketingDescription?: string | null; permitNumber?: string | null;
  brochureReference?: string | null; permitExpiryDate?: string | null; permitReferenceUrl?: string | null;
  projectAmenities_on_project?: Array<{amenityId: string}>;
};
type DeveloperOption = {id: string; name: string; status: string};
type AmenityOption = {id: string; name: string; category?: string | null};

function optional(form: FormData, name: string) {
  const value = String(form.get(name) ?? "").trim();
  return value || null;
}

function issueMap(issues: Array<{path: PropertyKey[]; message: string}>) {
  const result: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

function FormField({id, label, error, children, hint}: {id: string; label: string; error?: string; children: React.ReactNode; hint?: string}) {
  return <div className="space-y-1.5">
    <Label htmlFor={id}>{label}</Label>
    {children}
    {error ? <p id={`${id}-error`} className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}
  </div>;
}

export function DeveloperForm({company, developer}: {company: Company; developer: DeveloperRecord | null}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [country, setCountry] = useState(developer?.country ?? "AE");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const numberOrNull = (name: string) => { const value = String(form.get(name) ?? "").trim(); return value ? Number(value) : null; };
    const parsed = developerInputSchema.safeParse({
      name: String(form.get("name") ?? ""), slug: String(form.get("slug") ?? ""),
      logoReference: optional(form, "logoReference"), description: optional(form, "description"),
      website: optional(form, "website"), email: optional(form, "email"), phone: optional(form, "phone"),
      country: String(form.get("country") ?? "AE").toUpperCase(), headOfficeAddress: optional(form, "headOfficeAddress"),
      headOfficeLatitude: numberOrNull("headOfficeLatitude"), headOfficeLongitude: numberOrNull("headOfficeLongitude"),
      headOfficeGooglePlaceId: optional(form, "headOfficeGooglePlaceId"),
      status: String(form.get("status") ?? "ACTIVE"),
    });
    if (!parsed.success) { setErrors(issueMap(parsed.error.issues)); setFormError("Review the highlighted fields and try again."); return; }
    setPending(true); setErrors({}); setFormError("");
    try {
      const result = await leadRequest<{developer?: {id: string}}>(developer?.id ? `/api/inventory/developers/${developer.id}` : "/api/inventory/developers", developer?.id ? "PATCH" : "POST", parsed.data, company.id);
      toast.success(developer ? "Developer updated." : "Developer created.");
      const savedId = result.developer?.id ?? developer?.id;
      router.push(savedId ? `/developers/${savedId}` : "/developers");
      router.refresh();
    } catch (error) { setFormError(error instanceof Error ? error.message : "The developer could not be saved. Please try again."); }
    finally { setPending(false); }
  }

  const input = (name: string, value?: string | null, props: React.ComponentProps<typeof Input> = {}) => <Input id={name} name={name} defaultValue={value ?? ""} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} {...props} />;
  return <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-6">
    {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}
    <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
      <FormField id="name" label="Developer name" error={errors.name}>{input("name", developer?.name, {required: true, maxLength: 160, autoComplete: "organization"})}</FormField>
      <FormField id="slug" label="Unique slug" error={errors.slug} hint="Lowercase letters, numbers and hyphens.">{input("slug", developer?.slug, {required: true, maxLength: 80, autoComplete: "off"})}</FormField>
      <FormField id="logoReference" label="Logo URL" error={errors.logoReference} hint="Image uploads are not configured; use an HTTPS image URL if available.">{input("logoReference", developer?.logoReference, {type: "url", maxLength: 2048, placeholder: "https://example.com/logo.png"})}</FormField>
      <FormField id="website" label="Website" error={errors.website}>{input("website", developer?.website, {type: "url", maxLength: 2048, placeholder: "https://example.com"})}</FormField>
      <FormField id="email" label="Company email" error={errors.email}>{input("email", developer?.email, {type: "email", maxLength: 254, autoComplete: "email"})}</FormField>
      <FormField id="phone" label="Contact phone" error={errors.phone}>{input("phone", developer?.phone, {type: "tel", maxLength: 32, autoComplete: "tel"})}</FormField>
      <FormField id="country" label="Country code" error={errors.country} hint="Use the two-letter country code, for example AE."><Input id="country" name="country" value={country} onChange={event => setCountry(event.target.value.toUpperCase())} maxLength={2} required autoCapitalize="characters" aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "country-error" : undefined} /></FormField>
      <FormField id="status" label="Status" error={errors.status}><select id="status" name="status" defaultValue={developer?.status ?? "ACTIVE"} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></FormField>
      <section className="space-y-3 rounded-xl border p-4 sm:col-span-2" aria-labelledby="head-office-heading">
        <div><h2 id="head-office-heading" className="text-sm font-semibold">Head office</h2><p className="text-xs text-muted-foreground">Search for the office, or enter the address and place the pin. The head-office location is shown exactly to company members and does not change project locations.</p></div>
        <LocationFields organizationId={company.id} addressOnly requireUae={country.trim().toUpperCase() === "AE"} recordLabel={developer?.name || "the head office"} errors={errors}
          names={{address: "headOfficeAddress", latitude: "headOfficeLatitude", longitude: "headOfficeLongitude", googlePlaceId: "headOfficeGooglePlaceId"}}
          values={{address: developer?.headOfficeAddress, latitude: developer?.headOfficeLatitude, longitude: developer?.headOfficeLongitude, googlePlaceId: developer?.headOfficeGooglePlaceId}} />
      </section>
      <div className="sm:col-span-2"><FormField id="description" label="Company information" error={errors.description}>{<textarea id="description" name="description" defaultValue={developer?.description ?? ""} maxLength={4000} aria-invalid={Boolean(errors.description)} className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />}</FormField></div>
    </fieldset>
    <div className="flex justify-end gap-2 border-t pt-4"><Link href={developer?.id ? `/developers/${developer.id}` : "/developers"} className="inline-flex h-9 items-center rounded-lg border px-3 text-sm">Cancel</Link><Button type="submit" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : developer ? "Save changes" : "Create developer"}</Button></div>
  </form>;
}

function minorUnits(amount: string) {
  if (!amount) return null;
  if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(amount)) return undefined;
  const [whole, fraction = ""] = amount.split(".");
  return (BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2))).toString();
}

function amountFromMinor(value?: string | null) {
  if (!value) return "";
  try { return (Number(BigInt(value)) / 100).toFixed(2); } catch { return ""; }
}

export function ProjectForm({company, project, developers, amenities, defaultDeveloperId}: {company: Company; project: ProjectRecord | null; developers: DeveloperOption[]; amenities: AmenityOption[]; defaultDeveloperId?: string}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(project?.projectAmenities_on_project?.map(item => item.amenityId) ?? []);
  const linkedAmenities = project?.projectAmenities_on_project?.map(item => item.amenityId) ?? [];
  const [country, setCountry] = useState(project?.country ?? "AE");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawAmount = String(form.get("startingPrice") ?? "").trim();
    const priceMinor = minorUnits(rawAmount);
    if (priceMinor === undefined) { setErrors({startingPrice: "Enter a valid amount with up to two decimal places."}); setFormError("Review the highlighted fields and try again."); return; }
    const numberOrNull = (name: string) => { const value = String(form.get(name) ?? "").trim(); return value ? Number(value) : null; };
    const dateOrNull = (name: string) => optional(form, name);
    const parsed = projectInputSchema.safeParse({
      developerId: String(form.get("developerId") ?? ""), projectName: String(form.get("projectName") ?? ""),
      projectCode: String(form.get("projectCode") ?? ""), description: optional(form, "description"),
      projectType: String(form.get("projectType") ?? "RESIDENTIAL"), ownershipType: optional(form, "ownershipType"),
      community: optional(form, "community"), area: optional(form, "area"), emirate: optional(form, "emirate"),
      country: String(form.get("country") ?? "AE").toUpperCase(), address: optional(form, "address"),
      latitude: numberOrNull("latitude"), longitude: numberOrNull("longitude"),
      city: optional(form, "city"), googlePlaceId: optional(form, "googlePlaceId"), mapDisplayMode: String(form.get("mapDisplayMode") ?? "EXACT"),
      launchDate: dateOrNull("launchDate"), expectedHandoverDate: dateOrNull("expectedHandoverDate"), actualHandoverDate: dateOrNull("actualHandoverDate"),
      constructionStatus: String(form.get("constructionStatus") ?? "PLANNING"), projectStatus: String(form.get("projectStatus") ?? "DRAFT"),
      startingPriceMinor: priceMinor, currency: String(form.get("currency") ?? "AED").toUpperCase(),
      totalUnits: numberOrNull("totalUnits"), marketingDescription: optional(form, "marketingDescription"),
      brochureReference: optional(form, "brochureReference"),
      permitNumber: optional(form, "permitNumber"), permitExpiryDate: dateOrNull("permitExpiryDate"),
      permitReferenceUrl: optional(form, "permitReferenceUrl"),
    });
    if (!parsed.success) { setErrors(issueMap(parsed.error.issues)); setFormError("Review the highlighted fields and try again."); return; }
    setPending(true); setErrors({}); setFormError("");
    try {
      const result = await leadRequest<{project?: {id: string}}>(project?.id ? `/api/inventory/projects/${project.id}` : "/api/inventory/projects", project?.id ? "PATCH" : "POST", parsed.data, company.id);
      const id = project?.id ?? result.project?.id;
      const changed = selectedAmenities.filter(amenityId => !linkedAmenities.includes(amenityId));
      const removed = linkedAmenities.filter(amenityId => !selectedAmenities.includes(amenityId));
      const amenityResults = id ? await Promise.allSettled([
        ...changed.map(amenityId => leadRequest(`/api/inventory/projects/${id}/amenities`, "POST", {amenityId}, company.id)),
        ...removed.map(amenityId => leadRequest(`/api/inventory/projects/${id}/amenities/detach`, "POST", {amenityId}, company.id)),
      ]) : [];
      const failures = amenityResults.filter(item => item.status === "rejected").length;
      if (failures) toast.warning("Project saved, but some amenity changes were not saved. Review amenities on the project page.");
      toast.success(project ? "Project updated." : "Project created.");
      router.push(id ? `/projects/${id}` : "/projects");
      router.refresh();
    } catch (error) { setFormError(error instanceof Error ? error.message : "The project could not be saved. Please try again."); }
    finally { setPending(false); }
  }

  const input = (name: string, value?: string | number | null, props: React.ComponentProps<typeof Input> = {}) => <Input id={name} name={name} defaultValue={value ?? ""} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} {...props} />;
  const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
  const dateValue = (value?: string | null) => value?.slice(0, 10) ?? "";
  return <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-8">
    {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}
    <fieldset disabled={pending} className="space-y-8">
      <section className="space-y-4"><div><h2 className="font-semibold">Basic details</h2><p className="mt-1 text-xs text-muted-foreground">Core identity and project classification.</p></div><div className="grid gap-4 sm:grid-cols-2">
        <FormField id="projectName" label="Project name" error={errors.projectName}>{input("projectName", project?.projectName, {required: true, maxLength: 180})}</FormField>
        <FormField id="developerId" label="Developer" error={errors.developerId}><select id="developerId" name="developerId" defaultValue={project?.developerId ?? defaultDeveloperId ?? ""} aria-invalid={Boolean(errors.developerId)} className={selectClass} required><option value="">Choose a developer</option>{developers.filter(item => item.status === "ACTIVE" || item.id === project?.developerId).map(item => <option key={item.id} value={item.id}>{item.name}{item.status === "INACTIVE" ? " (inactive)" : ""}</option>)}</select></FormField>
        <FormField id="projectCode" label="Project reference" error={errors.projectCode}>{input("projectCode", project?.projectCode, {required: true, maxLength: 80})}</FormField>
        <FormField id="projectType" label="Project type" error={errors.projectType}><select id="projectType" name="projectType" defaultValue={project?.projectType ?? "RESIDENTIAL"} className={selectClass}>{["RESIDENTIAL", "COMMERCIAL", "MIXED_USE", "LAND"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></FormField>
        <FormField id="ownershipType" label="Ownership type" error={errors.ownershipType}><select id="ownershipType" name="ownershipType" defaultValue={project?.ownershipType ?? ""} className={selectClass}><option value="">Not set</option>{["FREEHOLD", "LEASEHOLD", "SHARED_OWNERSHIP"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></FormField>
        <FormField id="projectStatus" label="Project status" error={errors.projectStatus}><select id="projectStatus" name="projectStatus" defaultValue={project?.projectStatus ?? "DRAFT"} className={selectClass}>{["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"].map(value => <option key={value} value={value}>{value}</option>)}</select></FormField>
        <FormField id="constructionStatus" label="Construction status" error={errors.constructionStatus}><select id="constructionStatus" name="constructionStatus" defaultValue={project?.constructionStatus ?? "PLANNING"} className={selectClass}>{["PLANNING", "LAUNCHED", "UNDER_CONSTRUCTION", "COMPLETED", "ON_HOLD"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></FormField>
        <FormField id="description" label="Description" error={errors.description}>{<textarea id="description" name="description" defaultValue={project?.description ?? ""} maxLength={4000} className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />}</FormField>
      </div></section>
      <section className="space-y-4 border-t pt-6"><div><h2 className="font-semibold">Location</h2><p className="mt-1 text-xs text-muted-foreground">Record the project’s location. Map visibility controls how it appears on maps.</p></div>
        <div className="grid gap-4 sm:grid-cols-2"><FormField id="country" label="Country code" error={errors.country} hint="UAE projects (AE) require coordinates inside the UAE."><Input id="country" name="country" value={country} onChange={event => setCountry(event.target.value.toUpperCase())} maxLength={2} required aria-invalid={Boolean(errors.country)} aria-describedby={errors.country ? "country-error" : undefined} /></FormField></div>
        <LocationFields organizationId={company.id} values={project} errors={errors} defaultMode="EXACT" requireUae={country.trim().toUpperCase() === "AE"} recordLabel={project?.projectName || "this project"} />
      </section>
      <section className="space-y-4 border-t pt-6"><div><h2 className="font-semibold">Timeline</h2><p className="mt-1 text-xs text-muted-foreground">Dates are stored as calendar dates in the project record.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <FormField id="launchDate" label="Launch date" error={errors.launchDate}>{input("launchDate", dateValue(project?.launchDate), {type: "date"})}</FormField>
        <FormField id="expectedHandoverDate" label="Expected handover" error={errors.expectedHandoverDate}>{input("expectedHandoverDate", dateValue(project?.expectedHandoverDate), {type: "date"})}</FormField>
        <FormField id="actualHandoverDate" label="Actual handover" error={errors.actualHandoverDate}>{input("actualHandoverDate", dateValue(project?.actualHandoverDate), {type: "date"})}</FormField>
      </div></section>
      <section className="space-y-4 border-t pt-6"><div><h2 className="font-semibold">Marketing and references</h2><p className="mt-1 text-xs text-muted-foreground">Marketing highlights use the project description field. Store a brochure as a URL reference; file uploads are not configured.</p></div><div className="grid gap-4 sm:grid-cols-2">
        <FormField id="startingPrice" label="Starting price" error={errors.startingPrice}>{input("startingPrice", amountFromMinor(project?.startingPriceMinor), {type: "number", min: 0, step: "0.01", inputMode: "decimal"})}</FormField>
        <FormField id="currency" label="Currency code" error={errors.currency}>{input("currency", project?.currency ?? "AED", {maxLength: 3})}</FormField>
        <FormField id="totalUnits" label="Planned unit count" error={errors.totalUnits} hint="This is the project’s declared planned count. Actual inventory is shown separately.">{input("totalUnits", project?.totalUnits, {type: "number", min: 0, step: 1})}</FormField>
        <FormField id="brochureReference" label="Brochure URL" error={errors.brochureReference}>{input("brochureReference", project?.brochureReference, {type: "url", maxLength: 2048, placeholder: "https://example.com/brochure.pdf"})}</FormField>
        <FormField id="permitNumber" label="Permit number" error={errors.permitNumber}>{input("permitNumber", project?.permitNumber, {maxLength: 120})}</FormField>
        <FormField id="permitExpiryDate" label="Permit expiry date" error={errors.permitExpiryDate}>{input("permitExpiryDate", dateValue(project?.permitExpiryDate), {type: "date"})}</FormField>
        <FormField id="permitReferenceUrl" label="Permit reference URL" error={errors.permitReferenceUrl}>{input("permitReferenceUrl", project?.permitReferenceUrl, {type: "url", maxLength: 2048})}</FormField>
        <div className="sm:col-span-2"><FormField id="marketingDescription" label="Project highlights" error={errors.marketingDescription}>{<textarea id="marketingDescription" name="marketingDescription" defaultValue={project?.marketingDescription ?? ""} maxLength={4000} className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />}</FormField></div>
        <fieldset className="space-y-2 sm:col-span-2"><legend className="text-sm font-medium">Key amenities</legend>{amenities.length === 0 ? <p className="text-xs text-muted-foreground">No active company amenities are configured yet.</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{amenities.map(amenity => <label key={amenity.id} className="flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm"><input type="checkbox" checked={selectedAmenities.includes(amenity.id)} onChange={event => setSelectedAmenities(current => event.target.checked ? [...current, amenity.id] : current.filter(id => id !== amenity.id))} />{amenity.name}</label>)}</div>}<p className="text-xs text-muted-foreground">Amenities are attached to the project after its record saves.</p></fieldset>
      </div></section>
    </fieldset>
    {developers.length === 0 && <p className="text-sm text-muted-foreground" role="status">Create an active developer before adding a project. <Link href="/developers/new" className="text-primary underline">Add a developer</Link></p>}
    <div className="flex justify-end gap-2 border-t pt-4"><Link href={project?.id ? `/projects/${project.id}` : "/projects"} className="inline-flex h-9 items-center rounded-lg border px-3 text-sm">Cancel</Link><Button type="submit" disabled={pending || developers.length === 0}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{pending ? "Saving…" : project ? "Save changes" : "Create project"}</Button></div>
  </form>;
}
