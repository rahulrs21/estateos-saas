"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, Clock3, LoaderCircle, RotateCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { leadRequest } from "@/modules/leads/client";
import type { DistributionSettingsData } from "../types";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function AvailabilityButton({ organizationId, membershipId, availability }: {
  organizationId: string; membershipId: string; availability: {status: string; unavailableUntil: string | null} | null;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  // The server treats an expired unavailableUntil as available during routing.
  const unavailable = availability?.status === "UNAVAILABLE";
  async function toggle() {
    setPending(true); setError("");
    try {
      await leadRequest("/api/lead-distribution/availability", "PATCH", {
        membershipId, status: unavailable ? "AVAILABLE" : "UNAVAILABLE",
        unavailableUntil: null, reason: unavailable ? null : "Changed by a company administrator",
      }, organizationId);
      toast.success(unavailable ? "Agent marked available." : "Agent marked unavailable.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Availability could not be updated.");
    } finally { setPending(false); }
  }
  return <div className="flex flex-col items-start gap-1">
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggle} aria-label={`${unavailable ? "Mark" : "Set"} agent ${unavailable ? "available" : "unavailable"}`}>
      {pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Clock3 aria-hidden="true" />}{unavailable ? "Unavailable" : "Available"}
    </Button>
    {error && <span className="max-w-48 text-xs text-destructive" role="alert">{error}</span>}
  </div>;
}

export function LeadDistributionSettings({ data }: { data: DistributionSettingsData }) {
  const router = useRouter();
  const rule = data.rule;
  const canConfigure = data.role === "OWNER" || data.role === "ADMIN";
  const [enabled, setEnabled] = useState(rule?.enabled ?? false);
  const [mode, setMode] = useState<"MANUAL" | "ROUND_ROBIN">(rule?.mode ?? "MANUAL");
  const [branchId, setBranchId] = useState(rule?.branchId ?? "");
  const [projectId, setProjectId] = useState(rule?.projectId ?? "");
  const [skipUnavailable, setSkipUnavailable] = useState(rule?.skipUnavailable ?? true);
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(rule?.businessHoursEnabled ?? false);
  const [timeZone, setTimeZone] = useState(rule?.timeZone ?? "Asia/Dubai");
  const [businessDaysMask, setBusinessDaysMask] = useState(rule?.businessDaysMask ?? 62);
  const [businessStart, setBusinessStart] = useState(rule?.businessStart ?? "09:00");
  const [businessEnd, setBusinessEnd] = useState(rule?.businessEnd ?? "18:00");
  const [timeout, setTimeout] = useState(rule?.reassignmentTimeoutMinutes ?? 1440);
  const [eligibleAgentIds, setEligibleAgentIds] = useState(data.eligibleAgentIds);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{attempted: boolean; reason: string; membershipId?: string | null} | null>(null);

  function toggleAgent(id: string) {
    setEligibleAgentIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  }
  function toggleDay(day: number) {
    setBusinessDaysMask(current => current ^ (1 << day));
  }
  async function save() {
    if (pending) return;
    setPending(true); setMessage("");
    try {
      await leadRequest("/api/lead-distribution/settings", "PATCH", {
        enabled, mode, branchId: branchId || null, projectId: projectId.trim() || null,
        skipUnavailable, businessHoursEnabled, timeZone, businessDaysMask,
        businessStart, businessEnd, reassignmentTimeoutMinutes: Number(timeout), eligibleAgentIds,
      }, data.organizationId);
      setMessage("Lead distribution settings saved.");
      toast.success("Lead distribution settings saved.");
      router.refresh();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Settings could not be saved.");
    } finally { setPending(false); }
  }
  async function runPreview() {
    setPending(true); setMessage(""); setPreview(null);
    try {
      const result = await leadRequest<typeof preview>("/api/lead-distribution/preview", "POST", {
        branchId: branchId || null, projectId: projectId.trim() || null,
      }, data.organizationId);
      setPreview(result);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Rule preview could not be generated.");
    } finally { setPending(false); }
  }

  if (!canConfigure) {
    if (data.role === "AGENT") return <AgentAvailabilityPanel data={data} />;
    return <div className="rounded-xl border bg-card p-5 text-sm leading-6 text-muted-foreground">An owner or administrator manages company-wide lead distribution. Manager assignment actions remain limited to leads the manager is already authorized to access.</div>;
  }

  const previewAgent = preview?.membershipId ? data.agents.find(agent => agent.id === preview.membershipId) : null;
  const previewLabels: Record<string, string> = {
    ASSIGNED: "This lead would be assigned to the next eligible agent.",
    NO_ELIGIBLE_AGENT: "No selected active agent is available; the lead will stay in the unassigned queue and company administrators will be notified.",
    OUTSIDE_BUSINESS_HOURS: "The lead is outside configured business hours and will stay in the unassigned queue.",
    DISABLED: "Automatic assignment is disabled.",
    MANUAL_MODE: "Manual assignment is selected.",
    SCOPE_MISMATCH: "This branch or project does not match the rule filters.",
  };

  return <div className="space-y-6">
    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="distribution-rule-heading">
      <div className="mb-5"><h2 id="distribution-rule-heading" className="text-base font-semibold">Assignment rule</h2><p className="mt-1 text-sm text-muted-foreground">Choose how new company leads reach active agents.</p></div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Enable automatic assignment</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">When off, lead creation uses manual assignment choices.</span></span></label>
        <label className="space-y-2 text-sm font-medium">Distribution mode<select value={mode} onChange={event => setMode(event.target.value as "MANUAL" | "ROUND_ROBIN")} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="MANUAL">Manual</option><option value="ROUND_ROBIN">Round Robin</option></select></label>
        <label className="space-y-2 text-sm font-medium">Branch filter<select value={branchId} onChange={event => setBranchId(event.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm"><option value="">All branches</option>{data.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
        <label className="space-y-2 text-sm font-medium">Project filter (optional)<Input value={projectId} onChange={event => setProjectId(event.target.value)} placeholder="Project UUID" className="h-10" /><span className="block text-xs font-normal leading-5 text-muted-foreground">Project records are a future module; this filter matches a project UUID supplied by the lead API.</span></label>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={skipUnavailable} onChange={event => setSkipUnavailable(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Skip unavailable agents</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Availability is checked again inside the assignment transaction.</span></span></label>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={businessHoursEnabled} onChange={event => setBusinessHoursEnabled(event.target.checked)} className="mt-0.5 size-4 accent-primary" /><span><span className="font-medium">Use business hours</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Outside the schedule, new leads remain unassigned.</span></span></label>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm font-medium">Time zone<Input value={timeZone} onChange={event => setTimeZone(event.target.value)} maxLength={64} className="h-10" /><span className="block text-xs font-normal text-muted-foreground">Default: Asia/Dubai</span></label>
        <label className="space-y-2 text-sm font-medium">Start time<Input type="time" value={businessStart} onChange={event => setBusinessStart(event.target.value)} className="h-10" /></label>
        <label className="space-y-2 text-sm font-medium">End time<Input type="time" value={businessEnd} onChange={event => setBusinessEnd(event.target.value)} className="h-10" /></label>
      </div>
      <fieldset className="mt-4"><legend className="mb-2 text-sm font-medium">Business days</legend><div className="flex flex-wrap gap-2">{weekdays.map((day, index) => <label key={day} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"><input type="checkbox" checked={(businessDaysMask & (1 << index)) !== 0} onChange={() => toggleDay(index)} className="size-3.5 accent-primary" />{day.slice(0, 3)}</label>)}</div></fieldset>
      <div className="mt-5 grid gap-4 sm:max-w-xs"><label className="space-y-2 text-sm font-medium">Reassignment timeout (minutes)<Input type="number" min={5} max={43200} step={5} value={timeout} onChange={event => setTimeout(Number(event.target.value))} className="h-10" /><span className="block text-xs font-normal text-muted-foreground">Stored for future scheduled reassignment; no background scheduler is connected yet.</span></label></div>

      <fieldset className="mt-6 border-t pt-5"><legend className="text-sm font-semibold">Eligible agents</legend><p className="mt-1 text-xs leading-5 text-muted-foreground">Only active, verified AGENT memberships can receive automatic assignments.</p>
        {data.agents.length ? <ul className="mt-3 grid gap-2 sm:grid-cols-2">{data.agents.map(agent => <li key={agent.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><label className="flex min-w-0 items-center gap-3"><input type="checkbox" checked={eligibleAgentIds.includes(agent.id)} onChange={() => toggleAgent(agent.id)} className="size-4 shrink-0 accent-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{agent.displayName}</span><span className="block truncate text-xs text-muted-foreground">{agent.email}</span></span></label><AvailabilityButton organizationId={data.organizationId} membershipId={agent.id} availability={agent.availability} /></li>)}</ul> : <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">There are no active verified company agents yet. Round Robin will keep new leads unassigned until an agent is available.</p>}
      </fieldset>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}{pending ? "Saving…" : "Save settings"}</Button>
        <Button type="button" variant="outline" onClick={runPreview} disabled={pending}><RotateCw aria-hidden="true" />Preview rule</Button>
        {message && <p role="status" className="basis-full text-sm text-muted-foreground">{message}</p>}
      </div>
      {preview && <div role="status" className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"><p className="font-medium">{previewLabels[preview.reason] ?? "Rule preview complete."}</p>{previewAgent && <p className="mt-1 text-muted-foreground">Next agent: {previewAgent.displayName} ({previewAgent.email}).</p>}</div>}
    </section>

    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="distribution-history-heading">
      <div className="flex items-center gap-2"><RotateCw className="size-4 text-primary" aria-hidden="true" /><h2 id="distribution-history-heading" className="text-base font-semibold">Recent assignment history</h2></div>
      <p className="mt-1 text-sm text-muted-foreground">Tenant-scoped manual and automatic assignment events.</p>
      {data.history.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-2 pr-3">Lead</th><th className="py-2 pr-3">From</th><th className="py-2 pr-3">To</th><th className="py-2 pr-3">Type / reason</th><th className="py-2">Time</th></tr></thead><tbody className="divide-y">{data.history.map(row => <tr key={row.id}><td className="py-3 pr-3 font-medium">{row.leadName}</td><td className="py-3 pr-3 text-muted-foreground">{row.previousAgent ?? "—"}</td><td className="py-3 pr-3 text-muted-foreground">{row.newAgent ?? "Unassigned"}</td><td className="py-3 pr-3"><span className="font-medium">{row.assignmentType}</span>{row.reason && <span className="block max-w-56 truncate text-xs text-muted-foreground">{row.reason}</span>}</td><td className="py-3 text-xs text-muted-foreground"><time dateTime={row.assignedAt}>{new Intl.DateTimeFormat(undefined, {dateStyle: "medium", timeStyle: "short"}).format(new Date(row.assignedAt))}</time></td></tr>)}</tbody></table></div> : <div className="mt-4 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground"><BellRing className="mx-auto mb-2 size-5" aria-hidden="true" />Assignment events will appear here when leads are assigned.</div>}
    </section>
  </div>;
}

function AgentAvailabilityPanel({ data }: { data: DistributionSettingsData }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const unavailable = data.ownAvailability?.status === "UNAVAILABLE";
  async function save() {
    setPending(true); setError("");
    try {
      await leadRequest("/api/lead-distribution/availability", "PATCH", {
        status: unavailable ? "AVAILABLE" : "UNAVAILABLE", unavailableUntil: null,
        reason: unavailable ? null : "Changed by agent",
      }, data.organizationId);
      toast.success(unavailable ? "You are marked available." : "You are marked unavailable.");
      window.location.reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Your availability could not be updated."); }
    finally { setPending(false); }
  }
  return <section className="max-w-2xl rounded-xl border bg-card p-5 sm:p-6"><h2 className="text-base font-semibold">Your availability</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Availability only affects automatic assignment when the company rule is configured to skip unavailable agents.</p><div className="mt-4 flex flex-wrap items-center gap-3"><span className="rounded-full border px-3 py-1 text-xs font-medium">{unavailable ? "Unavailable" : "Available"}</span><Button type="button" variant="outline" onClick={save} disabled={pending}>{pending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Check aria-hidden="true" />}{unavailable ? "Mark available" : "Mark unavailable"}</Button></div>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}</section>;
}
