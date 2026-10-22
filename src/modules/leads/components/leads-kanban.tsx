"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, GripVertical, Loader2, LockKeyhole, MapPin, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { leadRequest } from "../client";
import { leadBudget, leadInitials, leadPriorityLabels } from "../presentation";
import type { LeadListData, LeadRecord, LeadStatus } from "../types";
import { formatLeadDate, selectClassName } from "./lead-ui";

type Stage = LeadListData["pipelines"][number]["stages"][number] & { pipelineId: string; pipelineName: string };
type Move = { id: string; stage: Stage };
const terminal = (lead: LeadRecord) => ["WON", "LOST", "CONVERTED"].includes(lead.status) || (lead.pipelineStage && lead.pipelineStage.stageType !== "OPEN");

/** Only a loaded authorized card can move; server policies remain authoritative. */
export function LeadsKanban({ data }: { data: LeadListData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const inFlight = useRef(false);
  const [optimisticLeads, optimisticMove] = useOptimistic(data.leads, (leads: LeadRecord[], move: Move) => leads.map(lead => lead.id === move.id ? {
    ...lead, pipelineStageId: move.stage.id, status: move.stage.status as LeadStatus,
    pipelineStage: { ...move.stage },
  } : lead));
  const stages: Stage[] = data.pipelines.flatMap(pipeline => pipeline.stages.map(stage => ({ ...stage, pipelineId: pipeline.id, pipelineName: pipeline.name })));
  const knownStages = new Set(stages.map(stage => `${stage.pipelineId}:${stage.id}`));
  const legacyLeads = optimisticLeads.filter(lead => !lead.pipelineStageId || !knownStages.has(`${lead.pipelineId}:${lead.pipelineStageId}`));
  const canMove = (lead: LeadRecord) => !lead.archivedAt && !terminal(lead) && !!lead.pipelineId && !!lead.pipelineStageId && stages.some(stage => stage.pipelineId === lead.pipelineId && stage.id === lead.pipelineStageId);

  function moveLead(leadId: string, stageId: string) {
    if (inFlight.current) return;
    const lead = optimisticLeads.find(item => item.id === leadId);
    const stage = stages.find(item => item.id === stageId && item.pipelineId === lead?.pipelineId);
    if (!lead || !stage || !canMove(lead) || lead.pipelineId !== stage.pipelineId || lead.pipelineStageId === stageId) return;
    inFlight.current = true;
    setError(""); setDraggedId(null);
    startTransition(async () => {
      optimisticMove({ id: leadId, stage });
      setAnnouncement(`Saving ${lead.fullName} in ${stage.name}.`);
      try {
        await leadRequest(`/api/leads/${leadId}/stage`, "POST", { pipelineStageId: stageId }, data.organization.id);
        setAnnouncement(`${lead.fullName} moved to ${stage.name}.`);
        toast.success(`Moved to ${stage.name}.`);
        router.refresh();
      } catch (failure) {
        const message = failure instanceof Error ? failure.message : "The stage could not be changed.";
        setError(message);
        setAnnouncement(`The change for ${lead.fullName} was not saved. Its previous stage has been restored.`);
        toast.error(message);
      } finally { inFlight.current = false; }
    });
  }

  function drop(event: DragEvent, stage: Stage) {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/x-estateos-lead");
    if (id && id === draggedId) moveLead(id, stage.id);
    setDraggedId(null);
  }

  function card(lead: LeadRecord) {
    const movable = canMove(lead);
    return <article key={lead.id} data-lead-id={lead.id} draggable={movable && !pending} onDragStart={event => {
      if (!movable || pending) { event.preventDefault(); return; }
      event.dataTransfer.setData("application/x-estateos-lead", lead.id);
      event.dataTransfer.effectAllowed = "move";
      setDraggedId(lead.id);
    }} onDragEnd={() => setDraggedId(null)} className={cn("space-y-3 rounded-xl border bg-card p-3.5 shadow-xs transition-shadow hover:shadow-sm", draggedId === lead.id && "opacity-50", movable && !pending && "cursor-grab active:cursor-grabbing")}>
      <div className="flex items-start gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-semibold text-primary" aria-hidden="true">{leadInitials(lead.fullName)}</span><div className="min-w-0 flex-1"><Link href={`/leads/${lead.id}`} draggable={false} className="block break-words text-xs font-semibold leading-5 hover:text-primary hover:underline">{lead.fullName}</Link><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{lead.phone || lead.email || "No contact details"}</p></div>{movable ? <GripVertical className="mt-1 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" /> : <LockKeyhole className="mt-1 size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}</div>
      {(lead.preferredLocation || lead.propertyInterest) && <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground"><MapPin className="size-3 shrink-0" aria-hidden="true" />{lead.preferredLocation || lead.propertyInterest}</p>}
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] font-medium tabular-nums">{leadBudget(lead)}</p><span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", lead.priority === "URGENT" ? "bg-destructive/10 text-destructive" : lead.priority === "HIGH" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{leadPriorityLabels[lead.priority || "NORMAL"]}</span></div>
      <div className="space-y-2 border-t pt-3 text-[11px] text-muted-foreground"><p className="flex items-center gap-1.5 truncate"><UserRound className="size-3 shrink-0" aria-hidden="true" />{lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email || "Unassigned"}</p>{lead.followUpAt && <p className="flex items-center gap-1.5"><CalendarClock className="size-3 shrink-0" aria-hidden="true" /><time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt)}</time></p>}</div>
      {movable ? <div><label htmlFor={`move-${lead.id}`} className="sr-only">Move {lead.fullName} to stage</label><select id={`move-${lead.id}`} aria-label={`Move ${lead.fullName} to stage`} className={cn(selectClassName, "h-8 text-[11px]")} value={lead.pipelineStageId || ""} disabled={pending} onChange={event => moveLead(lead.id, event.target.value)}>{stages.filter(stage => stage.pipelineId === lead.pipelineId).map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></div> : <p className="text-[10px] text-muted-foreground">{lead.archivedAt ? "Archived" : terminal(lead) ? "Final stage" : "Stage setup required · open lead details"}</p>}
    </article>;
  }

  return <section aria-label="Lead Kanban pipeline" aria-busy={pending} className="p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p id="kanban-help" className="text-xs leading-5 text-muted-foreground">Drag an open lead into a stage, or use its stage menu. Column counts reflect this page.</p>{pending && <span className="inline-flex items-center gap-1.5 text-xs text-primary"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Saving stage…</span>}</div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive">{error} The previous stage has been restored.</p>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {stages.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No active pipeline is available. Reload or contact your company administrator.</p> : <div tabIndex={0} role="region" aria-label="Pipeline columns. Scroll horizontally to see every stage." aria-describedby="kanban-help" className="flex gap-3 overflow-x-auto rounded-lg pb-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {stages.map(stage => { const columnLeads = optimisticLeads.filter(lead => lead.pipelineId === stage.pipelineId && lead.pipelineStageId === stage.id); const dragged = optimisticLeads.find(lead => lead.id === draggedId); const accepts = !pending && dragged && dragged.pipelineId === stage.pipelineId && dragged.pipelineStageId !== stage.id; return <section key={`${stage.pipelineId}:${stage.id}`} data-stage-id={stage.id} aria-label={`${stage.name} stage`} onDragOver={event => { if (accepts) {event.preventDefault(); event.dataTransfer.dropEffect = "move";} }} onDrop={event => drop(event,stage)} className={cn("w-[270px] shrink-0 rounded-xl border bg-muted/25 p-2.5", accepts && "border-primary/40 bg-primary/5")}><div className="mb-3 flex items-center justify-between gap-2 px-1 pt-1"><h3 className="flex items-center gap-2 text-xs font-semibold"><span className={cn("size-2 rounded-full", stage.stageType === "WON" ? "bg-emerald-500" : stage.stageType === "LOST" ? "bg-slate-400" : "bg-primary")} aria-hidden="true" />{stage.name}</h3><span className="rounded-md border bg-background px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">{columnLeads.length}</span></div>{data.pipelines.length > 1 && <p className="mb-3 px-1 text-[10px] text-muted-foreground">{stage.pipelineName}</p>}<div className="min-h-56 space-y-3">{columnLeads.length ? columnLeads.map(card) : <p className="rounded-lg border border-dashed px-3 py-8 text-center text-[11px] leading-5 text-muted-foreground">No leads in this stage on this page</p>}</div></section>; })}
      {legacyLeads.length > 0 && <section aria-label="Leads awaiting pipeline setup" className="w-[270px] shrink-0 rounded-xl border bg-muted/25 p-2.5"><h3 className="mb-3 p-1 text-xs font-semibold">Awaiting stage setup · {legacyLeads.length}</h3><div className="space-y-3">{legacyLeads.map(card)}</div></section>}
    </div>}
  </section>;
}
