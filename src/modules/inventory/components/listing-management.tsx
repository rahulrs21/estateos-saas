"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { listingInputSchema } from "../validation";

type Company = {id: string; name: string; role: string};
type PropertyOption = {id: string; propertyReference: string; propertyType: string; project?: {projectName: string}};
type AgentOption = {id: string; email: string; userProfile?: {displayName: string}};
export type ListingRecord = {
  id: string; propertyId: string; property: {id: string; propertyReference: string; propertyType: string; project?: {id: string; projectName: string}; building?: {id: string; name: string}};
  listingReference: string; listingPurpose: string; marketType: string; title: string; description?: string | null; askingPriceMinor: string;
  currency: string; rentalPeriod?: string | null; assignedMembershipId?: string | null; assignedMembership?: {email: string; userProfile?: {displayName: string}};
  listingStatus: string; publicationStatus: string; advertisingPermitNumber?: string | null; permitExpiryDate?: string | null; permitVerificationUrl?: string | null;
};
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
function humanize(value?: string | null) { return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not set"; }
function majorFromMinor(value?: string | null) { if (!value) return ""; try { return (Number(BigInt(value)) / 100).toFixed(2); } catch { return ""; } }
function minorFromMajor(value: string) { if (!value) return undefined; if (!/^\d{1,16}(?:\.\d{1,2})?$/.test(value)) return null; const [whole, fraction = ""] = value.split("."); return (BigInt(whole) * BigInt(100) + BigInt((fraction + "00").slice(0, 2))).toString(); }
function Field({id,label,children,hint}: {id:string;label:string;children:React.ReactNode;hint?:string}) { return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{children}{hint&&<p className="text-xs leading-5 text-muted-foreground">{hint}</p>}</div>; }

export function ListingForm({company, listing, properties, agents, currentMembershipId, defaultPropertyId}: {company: Company; listing: ListingRecord|null; properties: PropertyOption[]; agents: AgentOption[]; currentMembershipId: string; defaultPropertyId?: string}) {
  const router = useRouter(); const [pending,setPending]=useState(false); const [error,setError]=useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form=new FormData(event.currentTarget); const price=minorFromMajor(String(form.get("askingPrice")??"").trim());
    if (price === null) { setError("Enter a valid non-negative price with up to two decimal places."); return; }
    const role = company.role;
    const assignedMembershipId = role === "AGENT" ? currentMembershipId : String(form.get("assignedMembershipId")??"") || null;
    const parsed = listingInputSchema.safeParse({
      propertyId:String(form.get("propertyId")??""), listingReference:String(form.get("listingReference")??""),
      listingPurpose:String(form.get("listingPurpose")??"SALE"), marketType:String(form.get("marketType")??"SECONDARY"),
      title:String(form.get("title")??""), description:String(form.get("description")??"").trim()||null,
      askingPriceMinor:price, currency:String(form.get("currency")??"AED").toUpperCase(), rentalPeriod:String(form.get("rentalPeriod")??"")||null,
      assignedMembershipId, listingStatus:String(form.get("listingStatus")??"DRAFT"), publicationStatus:String(form.get("publicationStatus")??"NOT_PUBLISHED"),
      advertisingPermitNumber:String(form.get("advertisingPermitNumber")??"").trim()||null,
      permitExpiryDate:String(form.get("permitExpiryDate")??"")||null, permitVerificationUrl:String(form.get("permitVerificationUrl")??"").trim()||null,
    });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Review the listing details and try again."); return; }
    setPending(true); setError("");
    try {
      const result=await leadRequest<{propertyListing?:{id:string}}>(listing?.id?`/api/inventory/listings/${listing.id}`:"/api/inventory/listings",listing?.id?"PATCH":"POST",parsed.data,company.id);
      const id=listing?.id??result.propertyListing?.id;
      toast.success(listing?"Listing updated.":"Marketing listing created.");
      if(id) router.push(`/listings/${id}`); else router.push("/listings"); router.refresh();
    } catch (e) { setError(e instanceof Error?e.message:"The listing could not be saved."); } finally { setPending(false); }
  }
  return <form onSubmit={submit} noValidate aria-busy={pending} className="space-y-6">{error&&<p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
    <Card><CardHeader><CardTitle>Marketing listing</CardTitle><p className="text-sm text-muted-foreground">This is a separate marketing record attached to physical inventory. Saving here never publishes to an external portal.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
      <Field id="propertyId" label="Property"><select id="propertyId" name="propertyId" defaultValue={listing?.propertyId??defaultPropertyId??""} required disabled={Boolean(listing)} className={selectClass}><option value="">Choose property inventory</option>{properties.map(p=><option key={p.id} value={p.id}>{p.propertyReference} · {humanize(p.propertyType)}{p.project?.projectName?` · ${p.project.projectName}`:""}</option>)}</select></Field>
      <Field id="listingReference" label="Listing reference"><Input id="listingReference" name="listingReference" required defaultValue={listing?.listingReference??""} maxLength={80} /></Field>
      <Field id="listingPurpose" label="Purpose"><select id="listingPurpose" name="listingPurpose" defaultValue={listing?.listingPurpose??"SALE"} className={selectClass}><option value="SALE">Sale</option><option value="RENT">Rental</option></select></Field>
      <Field id="marketType" label="Market type"><select id="marketType" name="marketType" defaultValue={listing?.marketType??"SECONDARY"} className={selectClass}><option value="OFF_PLAN">Off-plan</option><option value="SECONDARY">Secondary</option></select></Field>
      <Field id="title" label="Listing title"><Input id="title" name="title" required defaultValue={listing?.title??""} maxLength={180} /></Field>
      <Field id="askingPrice" label="Asking price"><Input id="askingPrice" name="askingPrice" required type="number" min="0" step="0.01" defaultValue={majorFromMinor(listing?.askingPriceMinor)} /></Field>
      <Field id="currency" label="Currency"><Input id="currency" name="currency" defaultValue={listing?.currency??"AED"} maxLength={3} /></Field>
      <Field id="rentalPeriod" label="Rental period"><select id="rentalPeriod" name="rentalPeriod" defaultValue={listing?.rentalPeriod??""} className={selectClass}><option value="">Not applicable</option><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></Field>
      <div className="sm:col-span-2"><Field id="description" label="Marketing description"><textarea id="description" name="description" defaultValue={listing?.description??""} maxLength={4000} className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" /></Field></div>
      {company.role !== "AGENT" && <Field id="assignedMembershipId" label="Listing agent"><select id="assignedMembershipId" name="assignedMembershipId" defaultValue={listing?.assignedMembershipId??""} className={selectClass}><option value="">Unassigned</option>{agents.map(agent=><option key={agent.id} value={agent.id}>{agent.userProfile?.displayName||agent.email}</option>)}</select></Field>}
      {listing ? <Field id="listingStatus" label="Listing status" hint="Change the status with the workflow buttons on the listing page."><input type="hidden" name="listingStatus" value={listing.listingStatus} /><p id="listingStatus" className="flex h-10 items-center rounded-lg border bg-muted/30 px-3 text-sm">{humanize(listing.listingStatus)}</p></Field>
        : <Field id="listingStatus" label="Initial status"><select id="listingStatus" name="listingStatus" defaultValue="DRAFT" className={selectClass}>{["DRAFT", "PENDING_REVIEW"].map(value=><option key={value} value={value}>{humanize(value)}</option>)}</select></Field>}
      <Field id="publicationStatus" label="Publication readiness" hint="This records internal completeness only; it is not regulatory approval and does not publish externally."><select id="publicationStatus" name="publicationStatus" defaultValue={listing?.publicationStatus??"NOT_PUBLISHED"} className={selectClass}><option value="NOT_PUBLISHED">Not assessed</option><option value="READY">Ready for internal review</option></select></Field>
      <Field id="advertisingPermitNumber" label="Advertising permit reference"><Input id="advertisingPermitNumber" name="advertisingPermitNumber" defaultValue={listing?.advertisingPermitNumber??""} maxLength={120} /></Field>
      <Field id="permitExpiryDate" label="Permit expiry date"><Input id="permitExpiryDate" name="permitExpiryDate" type="date" defaultValue={listing?.permitExpiryDate?.slice(0,10)??""} /></Field>
      <div className="sm:col-span-2"><Field id="permitVerificationUrl" label="Permit reference URL" hint="A stored reference is not a verification or approval claim."><Input id="permitVerificationUrl" name="permitVerificationUrl" type="url" defaultValue={listing?.permitVerificationUrl??""} maxLength={2048} /></Field></div>
    </CardContent></Card>
    <div className="flex justify-end gap-2"><Link className={buttonVariants({variant:"outline"})} href={listing?.id?`/listings/${listing.id}`:"/listings"}>Cancel</Link><Button type="submit" disabled={pending||properties.length===0}>{pending?"Saving…":listing?"Save listing":"Create listing"}</Button></div>
    {properties.length===0&&<p role="status" className="text-sm text-muted-foreground">No available property inventory is available for a listing.</p>}
  </form>;
}
