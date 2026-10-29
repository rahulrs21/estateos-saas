"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Check, ChevronLeft, ChevronRight, FileText, ImageOff, ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { deleteInventoryMedia, updateInventoryMedia, uploadInventoryFile } from "../client";
import { propertyFeatureLabelsSchema, propertyInputSchema } from "../validation";
import { InventoryEmptyState, InventoryPagination } from "./inventory-access-state";
import { InventoryMapView } from "./inventory-map-view";
import { LocationFields } from "@/modules/maps/components/location-fields";
import { LocationMapCard } from "@/modules/maps/components/location-map-card";
import { describeLocation, type PresentedLocation } from "@/modules/maps/geo";
import type { InventoryMapData, PropertyMapPin } from "../server/views";
import { AiContentLink } from "@/modules/ai/content/components/ai-content-link";
import { PropertySalesActions } from "@/modules/ai/sales/components/property-sales-actions";

type Company = {id: string; name: string; role: string};
type ProjectOption = {id: string; projectName: string; developer: {name: string}};
type DeveloperOption = {id: string; name: string};
type BuildingOption = {id: string; projectId: string; name: string; reference?: string | null};
type AgentOption = {id: string; email: string; userProfile?: {displayName: string}};
type AmenityOption = {id: string; name: string; category?: string | null};
type PropertyMediaKind = "PROPERTY_PHOTO" | "FLOOR_PLAN" | "BROCHURE" | "DOCUMENT";
type Media = {id: string; fileName: string; contentType: string; mediaKind: string; sortOrder: number; isCover: boolean};
export type PropertyRecord = {
  id: string; propertyReference: string; projectId?: string | null; project?: {id?: string; projectName: string; projectCode?: string; developer: {id?: string; name: string}};
  buildingId?: string | null; building?: {id: string; name: string; reference?: string | null}; unitNumber?: string | null;
  propertyType: string; marketType: string; bedrooms?: number | null; bathrooms?: number | null; floorNumber?: number | null;
  builtUpArea?: number | null; plotArea?: number | null; areaUnit: string; furnishedStatus?: string | null; parkingSpaces?: number | null;
  view?: string | null; emirate?: string | null; community?: string | null; area?: string | null; address?: string | null;
  latitude?: number | null; longitude?: number | null; city?: string | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
  referencePriceMinor?: string | null; internalNotes?: string | null;
  ownershipReference?: string | null; mandateReference?: string | null; assignedMembershipId?: string | null;
  assignedMembership?: {email: string; userProfile?: {displayName: string}}; occupancyStatus: string; inventoryStatus: string;
  propertyAmenities_on_property: Array<{id: string; amenityId: string; amenity: {name: string}}>;
  propertyFeatures_on_property: Array<{id: string; key: string; valueType: string; textValue?: string | null; numberValue?: number | null; booleanValue?: boolean | null; unit?: string | null}>;
  inventoryMedias_on_property: Media[];
};

function optional(form: FormData, key: string) { const value = String(form.get(key) ?? "").trim(); return value || null; }
function numericOrNull(form: FormData, key: string) { const value = String(form.get(key) ?? "").trim(); return value ? Number(value) : null; }
function issueMap(issues: Array<{path: PropertyKey[]; message: string}>) { const result: Record<string, string> = {}; for (const issue of issues) result[String(issue.path[0] ?? "form")] ??= issue.message; return result; }
function minorFromMajor(value: string) { if (!value) return null; if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) return undefined; const [whole, fraction = ""] = value.split("."); return (BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2))).toString(); }
function majorFromMinor(value?: string | null) { if (!value) return ""; try { return (Number(BigInt(value)) / 100).toFixed(2); } catch { return ""; } }
function humanize(value?: string | null) { return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not provided"; }
function Field({id, label, error, hint, children}: {id: string; label: string; error?: string; hint?: string; children: React.ReactNode}) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{error ? <p id={`${id}-error`} className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs leading-5 text-muted-foreground">{hint}</p> : null}</div>; }
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const emirates = ["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"];
const propertyTypes = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"];

export function PropertyForm({company, property, projects, buildings, agents, amenities}: {company: Company; property: PropertyRecord | null; projects: ProjectOption[]; developers: DeveloperOption[]; buildings: BuildingOption[]; agents: AgentOption[]; amenities: AmenityOption[]}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [projectId, setProjectId] = useState(property?.projectId ?? "");
  const [files, setFiles] = useState<Array<{file: File; mediaKind: PropertyMediaKind}>>([]);
  const [amenityIds, setAmenityIds] = useState<string[]>(property?.propertyAmenities_on_property.map(item => item.amenityId) ?? []);
  const steps = ["Basic details", "Specifications", "Location", "Inventory", "Media"];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const price = minorFromMajor(String(form.get("referencePrice") ?? "").trim());
    if (price === undefined) { setErrors({referencePrice: "Enter a valid non-negative price with up to two decimal places."}); setFormError("Review the highlighted fields and try again."); setStep(3); return; }
    const featureLabels = String(form.get("features") ?? "").split(/\r?\n/).map(label => label.trim()).filter(Boolean);
    const parsedFeatureLabels = propertyFeatureLabelsSchema.safeParse(featureLabels);
    if (!parsedFeatureLabels.success) { setErrors({features: "Enter up to 30 feature names, each between 2 and 120 characters."}); setFormError("Review the highlighted feature names."); setStep(1); return; }
    const featureRows = parsedFeatureLabels.data.map((label, index) => ({
      label,
      key: label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 70) || `feature_${index + 1}`,
    }));
    const currentFeatureKeys = new Set(property?.propertyFeatures_on_property.map(item => item.key) ?? []);
    if (new Set(featureRows.map(item => item.key)).size !== featureRows.length || featureRows.some(item => currentFeatureKeys.has(item.key))) {
      setErrors({features: "Each new feature must be distinct and must not duplicate a feature already on this property."}); setFormError("Review the highlighted feature names."); setStep(1); return;
    }
    const parsed = propertyInputSchema.safeParse({
      propertyReference: String(form.get("propertyReference") ?? ""), projectId: optional(form, "projectId"), buildingId: optional(form, "buildingId"), unitNumber: optional(form, "unitNumber"),
      propertyType: String(form.get("propertyType") ?? "APARTMENT"), marketType: String(form.get("marketType") ?? "SECONDARY"),
      bedrooms: numericOrNull(form, "bedrooms"), bathrooms: numericOrNull(form, "bathrooms"), floorNumber: numericOrNull(form, "floorNumber"),
      builtUpArea: numericOrNull(form, "builtUpArea"), plotArea: numericOrNull(form, "plotArea"), areaUnit: String(form.get("areaUnit") ?? "SQFT"),
      furnishedStatus: optional(form, "furnishedStatus"), parkingSpaces: numericOrNull(form, "parkingSpaces"), view: optional(form, "view"),
      emirate: optional(form, "emirate"), community: optional(form, "community"), area: optional(form, "area"), address: optional(form, "address"),
      latitude: numericOrNull(form, "latitude"), longitude: numericOrNull(form, "longitude"), referencePriceMinor: price,
      city: optional(form, "city"), googlePlaceId: optional(form, "googlePlaceId"), mapDisplayMode: String(form.get("mapDisplayMode") ?? "APPROXIMATE"),
      internalNotes: optional(form, "internalNotes"), ownershipReference: optional(form, "ownershipReference"), mandateReference: optional(form, "mandateReference"),
      assignedMembershipId: optional(form, "assignedMembershipId"), occupancyStatus: String(form.get("occupancyStatus") ?? "VACANT"),
      inventoryStatus: String(form.get("inventoryStatus") ?? "DRAFT"),
    });
    if (!parsed.success) { const mapped = issueMap(parsed.error.issues); setErrors(mapped); setFormError("Review the highlighted fields and try again."); setStep(mapped.projectId || mapped.buildingId || mapped.propertyReference || mapped.propertyType ? 0 : mapped.bedrooms || mapped.builtUpArea ? 1 : mapped.emirate || mapped.community || mapped.area || mapped.city || mapped.address || mapped.latitude || mapped.longitude || mapped.googlePlaceId || mapped.mapDisplayMode ? 2 : 3); return; }
    setPending(true); setErrors({}); setFormError("");
    try {
      const result = await leadRequest<{property?: {id: string}}>(property?.id ? `/api/inventory/properties/${property.id}` : "/api/inventory/properties", property?.id ? "PATCH" : "POST", parsed.data, company.id);
      const id = property?.id ?? result.property?.id;
      if (!id) throw new Error("The property was saved but its record reference could not be loaded. Refresh the property list.");
      const oldAmenityIds = new Set(property?.propertyAmenities_on_property.map(item => item.amenityId) ?? []);
      const newAmenityIds = new Set(amenityIds);
      const relationWrites = [
        ...amenityIds.filter(amenityId => !oldAmenityIds.has(amenityId)).map(amenityId => leadRequest(`/api/inventory/properties/${id}/amenities`, "POST", {amenityId}, company.id)),
        ...[...oldAmenityIds].filter(amenityId => !newAmenityIds.has(amenityId)).map(amenityId => leadRequest(`/api/inventory/properties/${id}/amenities/detach`, "POST", {amenityId}, company.id)),
        ...featureRows.map(({key, label}) => leadRequest("/api/inventory/features", "POST", {propertyId: id, key, valueType: "TEXT", textValue: label}, company.id)),
      ];
      const relationOutcomes = await Promise.allSettled(relationWrites);
      const relationFailures = relationOutcomes.filter(outcome => outcome.status === "rejected").length;
      const outcomes = await Promise.allSettled(files.map(({file, mediaKind}) => uploadInventoryFile(file, {organizationId: company.id, parentType: "properties", parentId: id, mediaKind})));
      const failed = outcomes.filter(outcome => outcome.status === "rejected").length;
      if (failed || relationFailures) toast.warning(`Property saved. ${relationFailures ? `${relationFailures} amenity or feature change${relationFailures === 1 ? "" : "s"} failed. ` : ""}${failed ? `${failed} file${failed === 1 ? "" : "s"} could not be uploaded; retry from the property page.` : "Review the property details and retry the related changes."}`);
      else toast.success(property ? "Property updated." : "Property created.");
      router.push(`/properties/${id}`); router.refresh();
    } catch (error) { setFormError(error instanceof Error ? error.message : "The property could not be saved. Please try again."); }
    finally { setPending(false); }
  }

  const visibleBuildings = useMemo(() => buildings.filter(building => building.projectId === projectId), [buildings, projectId]);
  const field = (name: string, value?: string | number | null, props: React.ComponentProps<typeof Input> = {}) => <Input id={name} name={name} defaultValue={value ?? ""} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} {...props} />;
  const original = property;
  return <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-6">
    {formError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{formError}</p>}
    <nav aria-label="Property form steps" className="grid grid-cols-2 gap-2 sm:grid-cols-5">{steps.map((label, index) => <button type="button" key={label} onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={`rounded-lg border px-3 py-2 text-left text-xs sm:text-sm ${step === index ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground"}`}><span className="mr-2 font-semibold">{index + 1}.</span>{label}</button>)}</nav>
    <fieldset disabled={pending} className="space-y-5">
      <div hidden={step !== 0}><Card><CardHeader><CardTitle>Basic details</CardTitle><p className="text-sm text-muted-foreground">Identify the physical property. A marketing listing is created separately.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <Field id="propertyReference" label="Property reference" error={errors.propertyReference}>{field("propertyReference", original?.propertyReference, {required: true, maxLength: 80})}</Field>
        <Field id="propertyType" label="Property type" error={errors.propertyType}><select id="propertyType" name="propertyType" defaultValue={original?.propertyType ?? "APARTMENT"} className={selectClass}>{propertyTypes.map(item => <option key={item} value={item}>{humanize(item)}</option>)}</select></Field>
        <Field id="marketType" label="Inventory market" error={errors.marketType}><select id="marketType" name="marketType" defaultValue={original?.marketType ?? "SECONDARY"} className={selectClass}><option value="OFF_PLAN">Off-plan</option><option value="SECONDARY">Secondary</option></select></Field>
        <Field id="projectId" label="Project (optional)" error={errors.projectId}><select id="projectId" name="projectId" value={projectId} onChange={event => setProjectId(event.target.value)} className={selectClass}><option value="">Standalone property</option>{projects.map(project => <option key={project.id} value={project.id}>{project.projectName} · {project.developer.name}</option>)}</select></Field>
        <Field id="buildingId" label="Building (optional)" error={errors.buildingId}><select id="buildingId" name="buildingId" defaultValue={original?.buildingId ?? ""} disabled={!projectId} className={selectClass}><option value="">Not assigned</option>{visibleBuildings.map(building => <option key={building.id} value={building.id}>{building.name}{building.reference ? ` · ${building.reference}` : ""}</option>)}</select></Field>
        <Field id="unitNumber" label="Unit number" error={errors.unitNumber}>{field("unitNumber", original?.unitNumber, {maxLength: 80})}</Field>
      </CardContent></Card></div>
      <div hidden={step !== 1}><Card><CardHeader><CardTitle>Specifications</CardTitle><p className="text-sm text-muted-foreground">Record actual property specifications, not listing copy.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="bedrooms" label="Bedrooms" error={errors.bedrooms}>{field("bedrooms", original?.bedrooms, {type: "number", min: 0, max: 100, step: 1})}</Field>
        <Field id="bathrooms" label="Bathrooms" error={errors.bathrooms}>{field("bathrooms", original?.bathrooms, {type: "number", min: 0, max: 100, step: "0.5"})}</Field>
        <Field id="floorNumber" label="Floor number" error={errors.floorNumber}>{field("floorNumber", original?.floorNumber, {type: "number", min: 0, max: 300, step: 1})}</Field>
        <Field id="builtUpArea" label="Built-up area" error={errors.builtUpArea}>{field("builtUpArea", original?.builtUpArea, {type: "number", min: 0, step: "any"})}</Field>
        <Field id="plotArea" label="Plot area" error={errors.plotArea}>{field("plotArea", original?.plotArea, {type: "number", min: 0, step: "any"})}</Field>
        <Field id="areaUnit" label="Area unit"><select id="areaUnit" name="areaUnit" defaultValue={original?.areaUnit ?? "SQFT"} className={selectClass}><option value="SQFT">Square feet</option><option value="SQM">Square metres</option></select></Field>
        <Field id="parkingSpaces" label="Parking spaces" error={errors.parkingSpaces}>{field("parkingSpaces", original?.parkingSpaces, {type: "number", min: 0, max: 1000, step: 1})}</Field>
        <Field id="furnishedStatus" label="Furnishing" error={errors.furnishedStatus}><select id="furnishedStatus" name="furnishedStatus" defaultValue={original?.furnishedStatus ?? ""} className={selectClass}><option value="">Not specified</option>{["FURNISHED", "SEMI_FURNISHED", "UNFURNISHED"].map(item => <option key={item} value={item}>{humanize(item)}</option>)}</select></Field>
        <Field id="view" label="View" error={errors.view}>{field("view", original?.view, {maxLength: 120})}</Field>
        <fieldset className="space-y-2 sm:col-span-2 lg:col-span-3"><legend className="text-sm font-medium">Amenities</legend>{amenities.length ? <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{amenities.map(item => <label key={item.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={amenityIds.includes(item.id)} onChange={event => setAmenityIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id))} /><span>{item.name}</span></label>)}</div> : <p className="text-xs text-muted-foreground">No company amenities are configured yet.</p>}</fieldset>
        <div className="sm:col-span-2 lg:col-span-3"><Field id="features" label="Additional features (one per line)" error={errors.features} hint={original?.propertyFeatures_on_property.length ? `Existing features: ${original.propertyFeatures_on_property.map(item => item.textValue || humanize(item.key)).join(", ")}. Add new features below.` : "Examples: balcony, built-in wardrobes, private garden."}><textarea id="features" name="features" maxLength={2000} className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" aria-invalid={Boolean(errors.features)} aria-describedby={errors.features ? "features-error" : undefined} /></Field></div>
      </CardContent></Card></div>
      <div hidden={step !== 2}><Card><CardHeader><CardTitle>Location</CardTitle><p className="text-sm text-muted-foreground">UAE location for this unit. Coordinates are optional and remain company-private; map visibility controls how they are displayed.</p></CardHeader><CardContent>
        <LocationFields organizationId={company.id} values={original} errors={errors} defaultMode="APPROXIMATE" recordLabel={original?.propertyReference || "this property"} />
      </CardContent></Card></div>
      <div hidden={step !== 3}><Card><CardHeader><CardTitle>Inventory & mandate</CardTitle><p className="text-sm text-muted-foreground">Asking prices belong to the separate marketing listing record.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
        <Field id="inventoryStatus" label="Availability" error={errors.inventoryStatus}><select id="inventoryStatus" name="inventoryStatus" defaultValue={original?.inventoryStatus ?? "DRAFT"} className={selectClass}>{["DRAFT", "AVAILABLE", "RESERVED", "SOLD", "RENTED", "INACTIVE"].map(item => <option key={item} value={item}>{humanize(item)}</option>)}</select></Field>
        <Field id="occupancyStatus" label="Occupancy" error={errors.occupancyStatus}><select id="occupancyStatus" name="occupancyStatus" defaultValue={original?.occupancyStatus ?? "VACANT"} className={selectClass}>{["VACANT", "OCCUPIED", "TENANTED", "UNDER_CONSTRUCTION"].map(item => <option key={item} value={item}>{humanize(item)}</option>)}</select></Field>
        <Field id="referencePrice" label="Internal reference price (AED)" error={errors.referencePrice}>{field("referencePrice", majorFromMinor(original?.referencePriceMinor), {type: "number", min: 0, step: "0.01"})}</Field>
        <Field id="assignedMembershipId" label="Assigned agent" error={errors.assignedMembershipId}><select id="assignedMembershipId" name="assignedMembershipId" defaultValue={original?.assignedMembershipId ?? ""} className={selectClass}><option value="">Unassigned</option>{agents.map(agent => <option key={agent.id} value={agent.id}>{agent.userProfile?.displayName || agent.email}</option>)}</select></Field>
        <Field id="ownershipReference" label="Ownership reference" error={errors.ownershipReference}>{field("ownershipReference", original?.ownershipReference, {maxLength: 160})}</Field>
        <Field id="mandateReference" label="Mandate reference" error={errors.mandateReference}>{field("mandateReference", original?.mandateReference, {maxLength: 160})}</Field>
        <div className="sm:col-span-2"><Field id="internalNotes" label="Internal notes" error={errors.internalNotes}><textarea id="internalNotes" name="internalNotes" defaultValue={original?.internalNotes ?? ""} maxLength={4000} className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></Field></div>
      </CardContent></Card></div>
      <div hidden={step !== 4}><Card><CardHeader><CardTitle>Property media</CardTitle><p className="text-sm text-muted-foreground">Private company files: JPEG, PNG, WebP up to 20 MB, or PDF up to 20 MB. Files are served only through authenticated routes.</p></CardHeader><CardContent className="space-y-5">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center hover:bg-muted/30"><ImagePlus className="size-6 text-primary" aria-hidden="true" /><span className="text-sm font-medium">Choose property photos, floor plans, brochures or documents</span><span className="text-xs text-muted-foreground">JPEG, PNG, WebP and PDF files up to 20 MB each.</span><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={event => setFiles(current => [...current, ...Array.from(event.target.files ?? []).map(file => ({file, mediaKind: file.type.startsWith("image/") ? "PROPERTY_PHOTO" as const : "DOCUMENT" as const}))])} /></label>
        {files.length > 0 && <ul className="space-y-2">{files.map(({file, mediaKind}, index) => <li key={`${file.name}-${file.lastModified}-${index}`} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate">{file.name} <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span></span><select aria-label={`Media category for ${file.name}`} className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={mediaKind} onChange={event => setFiles(current => current.map((row, i) => i === index ? {...row, mediaKind: event.target.value as PropertyMediaKind} : row))}>{(file.type === "application/pdf" ? ["DOCUMENT", "PROPERTY_PHOTO", "FLOOR_PLAN", "BROCHURE"] : ["PROPERTY_PHOTO", "FLOOR_PLAN", "BROCHURE"]).map(kind => <option key={kind} value={kind}>{humanize(kind)}</option>)}</select><button type="button" className="text-xs text-destructive underline" onClick={() => setFiles(current => current.filter((_, i) => i !== index))}>Remove</button></li>)}</ul>}
        {original?.inventoryMedias_on_property?.length ? <MediaGallery company={company} media={original.inventoryMedias_on_property} canManage={true} /> : <p className="text-xs text-muted-foreground">Existing private media will appear here after upload.</p>}
        <p className="rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">If a property is new, the record is saved first and then files are uploaded. A file failure does not discard the property; retry from its detail page.</p>
      </CardContent></Card></div>
    </fieldset>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><Link href={property?.id ? `/properties/${property.id}` : "/properties"} className={buttonVariants({variant: "outline"})}><ArrowLeft aria-hidden="true" />Cancel</Link><div className="flex gap-2">{step > 0 && <Button type="button" variant="outline" onClick={() => setStep(value => value - 1)}><ChevronLeft aria-hidden="true" />Back</Button>}{step < steps.length - 1 ? <Button type="button" onClick={() => setStep(value => value + 1)}>Continue<ChevronRight aria-hidden="true" /></Button> : <Button type="submit" disabled={pending}>{pending ? "Saving…" : <><Check aria-hidden="true" />{property ? "Save property" : "Create property"}</>}</Button>}</div></div>
  </form>;
}

/**
 * Thumbnail or file tile for one media record. A record can outlive its stored
 * file (for example after local emulator data was lost); the content route then
 * answers 404, and the tile says so instead of showing a broken image, so an
 * administrator can delete the record and upload the file again.
 */
function MediaPreview({item}: {item: Media}) {
  const url = `/api/inventory/media/${item.id}/content`;
  const isImage = item.contentType.startsWith("image/");
  const [state, setState] = useState<"ok" | "missing" | "unavailable">("ok");
  const probe = useCallback(() => fetch(url, {method: "HEAD", credentials: "same-origin", cache: "no-store"}).then(response => response.status, () => 0), [url]);
  const stateFor = (status: number, afterImageError: boolean) => status === 404 ? "missing" : status < 200 || status >= 300 || afterImageError ? "unavailable" : "ok";
  // Images report failures through onError; other files are checked without downloading them.
  useEffect(() => {
    if (isImage) return;
    let active = true;
    probe().then(status => { if (active) setState(stateFor(status, false)); });
    return () => { active = false; };
  }, [isImage, probe]);
  if (state !== "ok") return <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center" role="status" data-media-state={state}>
    <ImageOff className="size-7 text-amber-500" aria-hidden="true" />
    <span className="text-sm font-medium">{state === "missing" ? "File missing" : "Preview unavailable"}</span>
    <span className="max-w-[90%] text-xs text-muted-foreground">{state === "missing" ? "The stored file no longer exists. Delete this record and upload the file again." : "The file could not be loaded. Reload the page to try again."}</span>
  </div>;
  if (isImage) return <Image src={url} alt={item.fileName} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" unoptimized className="object-cover" onError={() => void probe().then(status => setState(stateFor(status, true)))} />;
  return <a href={url} className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"><FileText className="size-8" aria-hidden="true" /><span className="max-w-[90%] truncate text-sm">{item.fileName}</span><span className="text-xs">Download</span></a>;
}

export function MediaGallery({company, media, canManage}: {company: Company; media: Media[]; canManage: boolean}) {
  const router = useRouter(); const [pendingId, setPendingId] = useState("");
  async function setCover(item: Media, index: number) { setPendingId(item.id); try { await updateInventoryMedia(item.id, {organizationId: company.id, sortOrder: index, isCover: true}); toast.success("Cover image updated."); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update the cover image."); } finally { setPendingId(""); } }
  async function remove(item: Media) { if (!window.confirm(`Delete ${item.fileName}?`)) return; setPendingId(item.id); try { await deleteInventoryMedia(item.id, company.id); toast.success("File deleted."); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "File deletion failed. The server will retain its cleanup state."); } finally { setPendingId(""); } }
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{media.map((item, index) => <Card key={item.id} className="overflow-hidden py-0"><div className="relative aspect-[4/3] bg-muted"><MediaPreview item={item} />{item.isCover && <Badge className="absolute top-2 left-2">Cover</Badge>}</div><CardContent className="flex items-center justify-between gap-2 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.fileName}</p><p className="text-xs text-muted-foreground">{humanize(item.mediaKind)}</p></div>{canManage && <div className="flex shrink-0 gap-1">{item.contentType.startsWith("image/") && item.mediaKind === "PROPERTY_PHOTO" && <Button variant="outline" size="sm" disabled={pendingId === item.id || item.isCover} onClick={() => setCover(item, index)} aria-label={`Set ${item.fileName} as cover`}>Cover</Button>}<Button variant="ghost" size="icon-sm" disabled={pendingId === item.id} onClick={() => remove(item)} aria-label={`Delete ${item.fileName}`}><Trash2 className="size-4" aria-hidden="true" /></Button></div>}</CardContent></Card>)}</div>;
}

type PropertyListRecord = Pick<PropertyRecord,"id"|"propertyReference"|"projectId"|"buildingId"|"unitNumber"|"propertyType"|"marketType"|"bedrooms"|"bathrooms"|"builtUpArea"|"areaUnit"|"emirate"|"community"|"area"|"referencePriceMinor"|"assignedMembershipId"|"inventoryStatus"> & {inventoryMedias_on_property: Media[]; project?: {projectName:string;developer?:{id:string;name:string}};building?:{name:string};assignedMembership?:{email:string;userProfile?:{displayName:string}}};
type PropertyListData = {company: Company; canManage: boolean; properties: PropertyListRecord[]; projects: ProjectOption[]; developers: DeveloperOption[]; agents: AgentOption[]; total: number; limit: number; offset: number; map: InventoryMapData<PropertyMapPin> | null};
export function PropertyList({data, filters, view}: {data: PropertyListData; filters: Record<string, string>; view: "table" | "cards" | "map"}) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value)));
  const filter = (id: string, label: string, items: Array<{value: string; label: string}>) => <label className="min-w-0 space-y-1 text-xs text-muted-foreground" htmlFor={id}>{label}<select id={id} name={id} defaultValue={filters[id] ?? ""} className={selectClass}><option value="">All</option>{items.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
  const properties = data.properties;
  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8"><PageHeader eyebrow={data.company.name} title="Properties" description="Manage company inventory and create separate marketing listings.">{data.canManage && <Link href="/properties/new" className={buttonVariants({size: "lg"})}><Plus aria-hidden="true" />Add property</Link>}<Link href="/listings" className={buttonVariants({variant: "outline"})}>Marketing listings<ArrowRight aria-hidden="true" /></Link></PageHeader>
    <Card><CardContent className="p-4"><form action="/properties" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6"><div className="space-y-1 text-xs text-muted-foreground xl:col-span-2"><Label htmlFor="search">Search reference or location</Label><Input id="search" name="search" defaultValue={filters.search} placeholder="Property reference" /></div>
      {filter("projectId", "Project", data.projects.map(x => ({value:x.id,label:x.projectName})))}{filter("developerId", "Developer", data.developers.map(x => ({value:x.id,label:x.name})))}
      {filter("emirate", "Emirate", emirates.map(x => ({value:x,label:humanize(x)})))}
      {filter("community", "Community", [...new Set(properties.map(x => x.community).filter((x): x is string => Boolean(x)))].map(x => ({value:x,label:x})))}
      {filter("propertyType", "Type", propertyTypes.map(x => ({value:x,label:humanize(x)})))}
      {filter("bedrooms", "Bedrooms", Array.from({length: 9}, (_, i) => ({value:String(i),label:i === 0 ? "Studio" : `${i}+`})))}
      {filter("inventoryStatus", "Availability", ["DRAFT","AVAILABLE","RESERVED","SOLD","RENTED","INACTIVE"].map(x => ({value:x,label:humanize(x)})))}
      {filter("assignedMembershipId", "Assigned agent", data.agents.map(x => ({value:x.id,label:x.userProfile?.displayName || x.email})))}
      {filter("buildingId", "Building", [...new Map(properties.filter(x => x.buildingId && x.building).map(x => [x.buildingId!, {value:x.buildingId!,label:x.building!.name}])).values()])}
      {filter("marketType", "Market", ["OFF_PLAN","SECONDARY"].map(x => ({value:x,label:humanize(x)})))}
      <div className="space-y-1 text-xs text-muted-foreground"><Label htmlFor="minimumPrice">Minimum price AED</Label><Input id="minimumPrice" name="minimumPrice" defaultValue={filters.minimumPrice} type="number" min="0" step="0.01" /></div><div className="space-y-1 text-xs text-muted-foreground"><Label htmlFor="maximumPrice">Maximum price AED</Label><Input id="maximumPrice" name="maximumPrice" defaultValue={filters.maximumPrice} type="number" min="0" step="0.01" /></div>
      <input type="hidden" name="view" value={view} /><Button type="submit" variant="outline" className="self-end">Apply filters</Button>
    </form></CardContent></Card>
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{data.total} properties recorded</p><div className="flex gap-1"><Link className={buttonVariants({variant:view === "table" ? "secondary" : "ghost", size:"sm"})} href={`/properties?${new URLSearchParams({...filters, view:"table"})}`}>Table</Link><Link className={buttonVariants({variant:view === "cards" ? "secondary" : "ghost", size:"sm"})} href={`/properties?${new URLSearchParams({...filters, view:"cards"})}`}>Cards</Link><Link className={buttonVariants({variant:view === "map" ? "secondary" : "ghost", size:"sm"})} href={`/properties?${new URLSearchParams({...filters, view:"map"})}`}>Map</Link></div></div>
    {view === "map" && data.map ? <InventoryMapView key={JSON.stringify(data.map.query)} resource="properties" noun="properties" data={data.map} query={data.map.query} toView={pin => ({
      id: pin.id, title: pin.propertyReference, href: `/properties/${pin.id}`, status: humanize(pin.inventoryStatus),
      subtitle: [humanize(pin.propertyType), pin.project?.projectName, pin.building?.name, pin.unitNumber].filter(Boolean).join(" · "),
      details: `${pin.bedrooms == null ? "Bedrooms not set" : pin.bedrooms === 0 ? "Studio" : `${pin.bedrooms} bed`} · ${pin.bathrooms ?? "—"} bath · ${pin.builtUpArea == null ? "Area not set" : `${pin.builtUpArea.toLocaleString()} ${pin.areaUnit}`}`,
      price: pin.referencePriceMinor ? `AED ${(Number(BigInt(pin.referencePriceMinor))/100).toLocaleString("en-AE")}` : null,
      locationText: describeLocation(pin), imageUrl: pin.coverMediaId ? `/api/inventory/media/${pin.coverMediaId}/content` : null, location: pin.location,
    })} /> : !properties.length ? <InventoryEmptyState icon={Building2} title="No properties found" description={Object.values(filters).some(Boolean) ? "Adjust or clear filters to see more inventory." : "Add the first company property. Inventory records and marketing listings are managed separately."} action={data.canManage && <Link href="/properties/new" className={buttonVariants()}><Plus aria-hidden="true" />Add property</Link>} /> : view === "cards" ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{properties.map(item => <Link key={item.id} href={`/properties/${item.id}`} className="group"><Card className="h-full overflow-hidden transition-colors group-hover:border-primary/40"><div className="relative aspect-[16/8] bg-muted">{item.inventoryMedias_on_property[0] ? <Image src={`/api/inventory/media/${item.inventoryMedias_on_property[0].id}/content`} alt={item.propertyReference} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" unoptimized className="object-cover" /> : <div className="flex size-full items-center justify-center text-muted-foreground"><Building2 className="size-10" aria-hidden="true" /></div>}</div><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{item.propertyReference}</p><p className="mt-1 text-xs text-muted-foreground">{item.project?.projectName || item.community || "Standalone property"}</p></div><Badge variant="outline">{humanize(item.inventoryStatus)}</Badge></div><p className="text-sm text-muted-foreground">{humanize(item.propertyType)} · {item.bedrooms == null ? "Bedrooms not set" : `${item.bedrooms} bed`} · {item.builtUpArea == null ? "Area not set" : `${item.builtUpArea.toLocaleString()} ${item.areaUnit}`}</p></CardContent></Card></Link>)}</div><InventoryPagination basePath="/properties" page={Math.max(1,data.offset/data.limit+1)} total={data.total} limit={data.limit} query={params.toString()} /></> : <Card className="overflow-hidden py-0"><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr>{["Property","Project / developer","Location","Specifications","Reference price","Assigned","Status"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y">{properties.map(item => <tr key={item.id} className="hover:bg-muted/20"><td className="px-4 py-3"><Link className="font-medium hover:text-primary" href={`/properties/${item.id}`}>{item.propertyReference}</Link><p className="mt-1 text-xs text-muted-foreground">{item.unitNumber || "No unit number"}</p></td><td className="px-4 py-3">{item.project?.projectName || "Standalone"}<p className="mt-1 text-xs text-muted-foreground">{item.project?.developer?.name || ""}</p></td><td className="px-4 py-3">{[item.community,item.area,humanize(item.emirate)].filter(Boolean).join(", ") || "Not recorded"}</td><td className="px-4 py-3">{humanize(item.propertyType)}<p className="mt-1 text-xs text-muted-foreground">{item.bedrooms == null ? "—" : `${item.bedrooms} bed`} · {item.bathrooms ?? "—"} bath</p></td><td className="px-4 py-3">{item.referencePriceMinor ? `AED ${(Number(BigInt(item.referencePriceMinor))/100).toLocaleString("en-AE")}` : "Not set"}</td><td className="px-4 py-3">{item.assignedMembership?.userProfile?.displayName || item.assignedMembership?.email || "Unassigned"}</td><td className="px-4 py-3"><Badge variant="outline">{humanize(item.inventoryStatus)}</Badge><p className="mt-1 text-xs text-muted-foreground">{humanize(item.marketType)}</p></td></tr>)}</tbody></table></div><InventoryPagination basePath="/properties" page={Math.max(1,data.offset/data.limit+1)} total={data.total} limit={data.limit} query={params.toString()} /></Card>}
  </div>;
}

export function PropertyDetail({company, property, location, listings, canManage}: {company: Company; property: PropertyRecord; location: PresentedLocation; listings: Array<{id: string; listingReference: string; title: string; listingPurpose: string; listingStatus: string; askingPriceMinor: string; currency: string}>; canManage: boolean}) {
  const [showNotes, setShowNotes] = useState(false);
  const value = (label: string, item: React.ReactNode) => <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{item ?? "Not provided"}</dd></div>;
  return <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8"><Link href="/properties" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Properties</Link><PageHeader eyebrow={`${company.name} · ${humanize(property.marketType)}`} title={property.propertyReference} description={`${humanize(property.propertyType)}${property.project ? ` · ${property.project.projectName}` : " · Standalone inventory"}`}><AiContentLink label="Generate AI Description" type="PROPERTY_DESCRIPTION" purpose="LISTING_DESCRIPTION" record={{kind: "propertyId", id: property.id}} />{canManage && <><Link href={`/properties/${property.id}/edit`} className={buttonVariants({variant:"outline"})}><Pencil aria-hidden="true" />Edit property</Link><Link href={`/listings/new?propertyId=${property.id}`} className={buttonVariants()}><Plus aria-hidden="true" />Create listing</Link></>}</PageHeader>
    <div className="flex flex-wrap gap-2"><Badge variant="outline">{humanize(property.inventoryStatus)}</Badge><Badge variant="outline">{humanize(property.occupancyStatus)}</Badge><Badge variant="secondary">{humanize(property.marketType)}</Badge></div>
    <PropertySalesActions propertyId={property.id} organizationId={company.id} />
    <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Property media</CardTitle><p className="mt-1 text-sm text-muted-foreground">Only active company media is displayed.</p></div>{canManage && <Link href={`/properties/${property.id}/edit?step=media`} className={buttonVariants({variant:"outline",size:"sm"})}>Manage files</Link>}</div></CardHeader><CardContent>{property.inventoryMedias_on_property.length ? <MediaGallery company={company} media={property.inventoryMedias_on_property} canManage={canManage} /> : <InventoryEmptyState icon={ImagePlus} title="No media uploaded" description="Property photos, floor plans and private documents will appear here after an authorized upload." />}</CardContent></Card>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,.8fr)]"><div className="space-y-5"><Card><CardHeader><CardTitle>Specifications</CardTitle></CardHeader><CardContent><dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{value("Property type",humanize(property.propertyType))}{value("Bedrooms",property.bedrooms)}{value("Bathrooms",property.bathrooms)}{value("Floor",property.floorNumber)}{value("Built-up area",property.builtUpArea && `${property.builtUpArea.toLocaleString()} ${property.areaUnit}`)}{value("Plot area",property.plotArea && `${property.plotArea.toLocaleString()} ${property.areaUnit}`)}{value("Furnishing",humanize(property.furnishedStatus))}{value("Parking",property.parkingSpaces)}{value("View",property.view)}</dl></CardContent></Card><Card><CardHeader><CardTitle>Location</CardTitle></CardHeader><CardContent><dl className="grid gap-5 sm:grid-cols-2">{value("Emirate",humanize(property.emirate))}{value("Community",property.community)}{value("Area",property.area)}{value("City",property.city)}{value("Address",property.address)}{value("Project",property.project ? <Link className="text-primary hover:underline" href={`/projects/${property.project.id}`}>{property.project.projectName}</Link> : "Standalone property")}{value("Building",property.building?.name)}{value("Unit",property.unitNumber)}</dl></CardContent></Card><LocationMapCard recordLabel={property.propertyReference} location={location} summary={describeLocation(property)} /><Card><CardHeader><CardTitle>Marketing listings</CardTitle></CardHeader><CardContent>{listings.length ? <div className="space-y-2">{listings.map(item => <Link key={item.id} href={`/listings/${item.id}`} className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/30"><span><strong className="text-sm">{item.title}</strong><span className="block text-xs text-muted-foreground">{item.listingReference} · {humanize(item.listingPurpose)}</span></span><Badge variant="outline">{humanize(item.listingStatus)}</Badge></Link>)}</div> : <InventoryEmptyState title="No marketing listings" description="A property is not advertised automatically. Create a separate listing when the record is ready for marketing." action={canManage && <Link href={`/listings/new?propertyId=${property.id}`} className={buttonVariants()}><Plus aria-hidden="true" />Create listing</Link>} />}</CardContent></Card></div>
      <div className="space-y-5"><Card><CardHeader><CardTitle>Inventory responsibility</CardTitle></CardHeader><CardContent><dl className="space-y-4">{value("Assigned agent",property.assignedMembership?.userProfile?.displayName || property.assignedMembership?.email)}{value("Internal reference price",property.referencePriceMinor ? `AED ${(Number(BigInt(property.referencePriceMinor))/100).toLocaleString("en-AE")}` : null)}{value("Ownership reference",property.ownershipReference)}{value("Mandate reference",property.mandateReference)}</dl></CardContent></Card><Card><CardHeader><CardTitle>Amenities &amp; features</CardTitle></CardHeader><CardContent className="space-y-3"><div><p className="text-xs text-muted-foreground">Amenities</p><p className="mt-1 text-sm">{property.propertyAmenities_on_property.map(item => item.amenity.name).join(", ") || "Not recorded"}</p></div><div><p className="text-xs text-muted-foreground">Features</p><ul className="mt-1 space-y-1 text-sm">{property.propertyFeatures_on_property.map(item => <li key={item.id}>{item.textValue || humanize(item.key)}</li>)}{property.propertyFeatures_on_property.length === 0 && <li className="text-muted-foreground">Not recorded</li>}</ul></div></CardContent></Card><Card><CardHeader><button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={showNotes} onClick={() => setShowNotes(value => !value)}><CardTitle>Internal notes</CardTitle><span className="text-xs text-primary">{showNotes ? "Hide" : "Show"}</span></button></CardHeader>{showNotes && <CardContent><p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{property.internalNotes || "No internal notes have been recorded."}</p></CardContent>}</Card></div></div>
  </div>;
}
