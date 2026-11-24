"use client";

import { useId, useState, type FormEvent } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { leadRequest } from "@/modules/leads/client";
import { selectClassName } from "@/modules/leads/components/lead-ui";
import type { MetaLeadPagesView } from "../server/connect";

type Form = MetaLeadPagesView["pages"][number]["forms"][number];
type Field = "budget" | "preferredLocation" | "bedroomPreference" | "propertyType" | "transactionType" | "propertyInterest";

/** The value for "never fill this field" (the same as NOT_USED in ../meta, which is server code). */
export const NOT_USED = "__none__";
const AUTO = "";
export const FIELD_LABELS: Record<Field, string> = {
  budget: "Budget", preferredLocation: "Preferred location", bedroomPreference: "Bedrooms",
  propertyType: "Property type", transactionType: "Buy, rent or invest", propertyInterest: "Property interest",
};
const FIELDS = Object.keys(FIELD_LABELS) as Field[];
const IDENTITY = new Set(["full_name", "first_name", "last_name", "email", "work_email", "phone_number", "work_phone_number"]);

/** A Meta form's settings in a side panel: import on or off, the branch its leads go to, and which question fills which lead field. */
export function MetaFormPanel({ form, branches, organizationId, onClose, onSaved }: {
  form: Form | null; branches: MetaLeadPagesView["branches"]; organizationId: string; onClose: () => void; onSaved: (name: string) => void;
}) {
  const prefix = useId();
  const [enabled, setEnabled] = useState(form?.enabled ?? true);
  const [branchId, setBranchId] = useState(form?.branchId ?? "");
  const [mapping, setMapping] = useState<Record<string, string>>(() => ({...(form?.fieldMapping ?? {})}));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const questions = (form?.questions ?? []).filter(question => !IDENTITY.has(question.key));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setPending(true); setError("");
    try {
      const fieldMapping = Object.fromEntries(Object.entries(mapping).filter(([, value]) => value !== AUTO));
      await leadRequest(`/api/lead-ads/meta/forms/${form.id}`, "PATCH", {enabled, branchId: branchId || null, fieldMapping}, organizationId);
      onSaved(form.name);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The form could not be saved."); }
    finally { setPending(false); }
  }

  return <Sheet open={form !== null} onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
      <SheetHeader className="border-b px-5 py-4">
        <SheetTitle>{form?.name ?? "Lead form"}</SheetTitle>
        <SheetDescription>Meta form {form?.metaFormId}{form?.sourceName ? ` · Lead source "${form.sourceName}"` : ""}</SheetDescription>
      </SheetHeader>
      <form id={`${prefix}-form`} onSubmit={save} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4" aria-busy={pending}>
        {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
        <fieldset disabled={pending} className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div><p className="text-sm font-medium">Import leads from this form</p>
              <p className="mt-0.5 text-xs text-muted-foreground">When off, new leads from this form are recorded but not added to EstateOS.</p></div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Import leads from this form" data-testid="meta-form-enabled" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`${prefix}-branch`}>Branch for its leads</Label>
            <select id={`${prefix}-branch`} name="branchId" className={selectClassName} value={branchId} onChange={event => setBranchId(event.target.value)}>
              <option value="">Company default</option>
              {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">New leads go to this branch, and the branch&apos;s assignment rules apply.</p>
          </div>
          <div className="space-y-3">
            <div><h3 className="text-sm font-medium">Which question fills which lead field</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Name, email and phone always come from Meta&apos;s standard questions. Every answer is kept on the lead either way.</p></div>
            {questions.length === 0 ? <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">EstateOS has not read this form&apos;s questions yet. Use Import recent leads, then open this panel again.</p>
              : <div className="divide-y rounded-lg border">{FIELDS.map(field => <div key={field} className="grid gap-1.5 p-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
                <Label htmlFor={`${prefix}-${field}`} className="text-xs">{FIELD_LABELS[field]}</Label>
                <select id={`${prefix}-${field}`} name={`map-${field}`} className={selectClassName} value={mapping[field] ?? AUTO} onChange={event => setMapping(current => ({...current, [field]: event.target.value}))}>
                  <option value={AUTO}>Detect automatically</option>
                  <option value={NOT_USED}>Not used</option>
                  {questions.map(question => <option key={question.key} value={question.key}>{question.label}</option>)}
                </select>
              </div>)}</div>}
          </div>
        </fieldset>
      </form>
      <SheetFooter className="flex-row justify-end gap-2 border-t px-5 py-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
        <Button type="submit" form={`${prefix}-form`} disabled={pending} data-testid="meta-form-save">{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}Save</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>;
}
