"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leadRequest } from "@/modules/leads/client";
import { uploadInventoryFile } from "../client";
import { floorPlanInputSchema } from "../validation";

const propertyTypes = ["APARTMENT", "VILLA", "TOWNHOUSE", "PENTHOUSE", "PLOT", "COMMERCIAL", "OFFICE", "RETAIL", "WAREHOUSE"];
const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
type Unit = {id: string; propertyReference: string; propertyType: string};
type Building = {id: string; name: string; projectId: string};

export function FloorPlanManager({companyId, projectId, units, buildings, canManage}: {companyId: string; projectId: string; units: Unit[]; buildings: Building[]; canManage: boolean}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [savedFloorPlanId, setSavedFloorPlanId] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (key: string) => {
      const raw = String(form.get(key) ?? "").trim();
      return raw ? Number(raw) : null;
    };
    let id = savedFloorPlanId;
    if (!id) {
      const parsed = floorPlanInputSchema.safeParse({
        projectId,
        propertyId: String(form.get("propertyId") ?? "") || null,
        buildingId: String(form.get("buildingId") ?? "") || null,
        name: String(form.get("name") ?? ""),
        propertyType: String(form.get("propertyType") ?? "APARTMENT"),
        bedrooms: number("bedrooms"),
        builtUpArea: number("builtUpArea"),
        plotArea: number("plotArea"),
        areaUnit: String(form.get("areaUnit") ?? "SQFT"),
        mediaReference: null,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the floor-plan details.");
        return;
      }
      setPending(true);
      setError("");
      try {
        const result = await leadRequest<{floorPlan?: {id: string}}>("/api/inventory/floor-plans", "POST", parsed.data, companyId);
        id = result.floorPlan?.id ?? "";
        if (!id) throw new Error("The floor-plan record was saved, but its identifier was not returned.");
        setSavedFloorPlanId(id);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Floor plan could not be saved.");
        setPending(false);
        return;
      }
    } else {
      setPending(true);
      setError("");
    }

    try {
      const file = form.get("floorPlanFile");
      if (file instanceof File && file.size > 0) {
        await uploadInventoryFile(file, {organizationId: companyId, parentType: "floor-plans", parentId: id, mediaKind: "FLOOR_PLAN"});
      }
      toast.success(file instanceof File && file.size > 0 ? "Floor plan and private file saved." : "Floor plan saved.");
      setOpen(false);
      setSavedFloorPlanId("");
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error
        ? `Floor plan record saved. File upload failed: ${uploadError.message} Choose the file again and retry; a second floor-plan record will not be created.`
        : "Floor plan record saved, but the file upload failed. Choose the file again and retry.");
      toast.warning("Floor plan saved, but its file still needs to be uploaded.");
    } finally {
      setPending(false);
    }
  }

  if (!canManage) return null;
  const retryingUpload = Boolean(savedFloorPlanId);
  return <Card>
    <CardHeader className="flex flex-row items-center justify-between gap-3">
      <div><CardTitle>Floor plans</CardTitle><p className="mt-1 text-sm text-muted-foreground">Link an actual plan to this project and optionally an inventory unit.</p></div>
      <Button variant="outline" size="sm" onClick={() => {setOpen(value => !value); setError(""); setSavedFloorPlanId("");}}>{open ? "Close" : <><Plus aria-hidden="true" />Add floor plan</>}</Button>
    </CardHeader>
    {open && <CardContent>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {error && <p role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-3">{error}</p>}
        {retryingUpload && <p role="status" className="rounded-lg border bg-muted/20 p-3 text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">The floor-plan record is already saved. Choose the file to retry its upload; this form will not create another record.</p>}
        <div className="space-y-1.5"><Label htmlFor="floor-name">Name</Label><Input id="floor-name" name="name" required maxLength={160} disabled={retryingUpload} /></div>
        <div className="space-y-1.5"><Label htmlFor="floor-property">Related unit (optional)</Label><select id="floor-property" name="propertyId" className={selectClass} disabled={retryingUpload}><option value="">Project-level plan</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.propertyReference} · {unit.propertyType}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="floor-building">Building</Label><select id="floor-building" name="buildingId" className={selectClass} disabled={retryingUpload}><option value="">Not assigned</option>{buildings.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="floor-type">Property type</Label><select id="floor-type" name="propertyType" className={selectClass} disabled={retryingUpload}>{propertyTypes.map(item => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="floor-bedrooms">Bedrooms</Label><Input id="floor-bedrooms" name="bedrooms" type="number" min="0" max="100" step="1" disabled={retryingUpload} /></div>
        <div className="space-y-1.5"><Label htmlFor="floor-area">Built-up area</Label><Input id="floor-area" name="builtUpArea" type="number" min="0.01" step="any" disabled={retryingUpload} /></div>
        <div className="space-y-1.5"><Label htmlFor="floor-plot">Plot area</Label><Input id="floor-plot" name="plotArea" type="number" min="0.01" step="any" disabled={retryingUpload} /></div>
        <div className="space-y-1.5"><Label htmlFor="floor-unit">Area unit</Label><select id="floor-unit" name="areaUnit" className={selectClass} disabled={retryingUpload}><option value="SQFT">Square feet</option><option value="SQM">Square metres</option></select></div>
        <div className="space-y-1.5"><Label htmlFor="floor-file">Upload plan (PDF or image)</Label><Input id="floor-file" name="floorPlanFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={pending} /></div>
        <div className="flex justify-end sm:col-span-2 lg:col-span-3"><Button disabled={pending}>{pending ? "Saving…" : <><FilePlus2 aria-hidden="true" />{retryingUpload ? "Retry file upload" : "Save floor plan"}</>}</Button></div>
      </form>
    </CardContent>}
  </Card>;
}
