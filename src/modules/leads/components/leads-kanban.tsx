"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { LayoutGroup, MotionConfig, motion } from "motion/react";
import { CalendarClock, ExternalLink, Flag, Loader2, LockKeyhole, MapPin, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { leadRequest } from "../client";
import { LeadChannelTag } from "./lead-source";
import { leadBudget } from "../presentation";
import type { LeadListData, LeadRecord, LeadStatus } from "../types";
import { STATUS_DOTS } from "./lead-filter-bar";
import { formatLeadDate, LeadAvatar } from "./lead-ui";
import { useClientNow } from "./use-client-now";

type Stage = LeadListData["pipelines"][number]["stages"][number] & { pipelineId: string; pipelineName: string };
type Move = { id: string; stage: Stage };
const terminal = (lead: LeadRecord) => ["WON", "LOST", "CONVERTED"].includes(lead.status) || (lead.pipelineStage && lead.pipelineStage.stageType !== "OPEN");
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/** The column's pipeline value: each lead's top budget, when the column uses one currency. */
function columnValue(leads: LeadRecord[]) {
  const values = leads.map(lead => ({ amount: lead.budgetMax ?? lead.budgetMin, currency: lead.currency || "AED" })).filter(row => row.amount != null);
  if (!values.length || new Set(values.map(row => row.currency)).size > 1) return null;
  return `${values[0].currency} ${compact.format(values.reduce((sum, row) => sum + (row.amount ?? 0), 0))}`;
}

const spring = { type: "spring", stiffness: 520, damping: 40, mass: 0.7 } as const;

/** Only a loaded authorized card can move; server policies remain authoritative. */
export function LeadsKanban({ data }: { data: LeadListData }) {
  const router = useRouter();
  const now = useClientNow();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);
  // Cards fade in once when the board opens; after that, only moves animate.
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setIntroDone(true), 700); return () => clearTimeout(timer); }, []);
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
    setError(""); setDraggedId(null); setOverStageId(null);
    startTransition(async () => {
      optimisticMove({ id: leadId, stage });
      setAnnouncement(`Saving ${lead.fullName} in ${stage.name}.`);
      try {
        await leadRequest(`/api/leads/${leadId}/stage`, "POST", { pipelineStageId: stageId }, data.organization.id);
        setAnnouncement(`${lead.fullName} moved to ${stage.name}.`);
        toast.success(`${lead.fullName} moved to ${stage.name}.`);
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
    setDraggedId(null); setOverStageId(null);
  }

  function card(lead: LeadRecord, index: number) {
    const movable = canMove(lead);
    const agent = lead.assignedMembership?.userProfile?.displayName || lead.assignedMembership?.email;
    const overdue = !!lead.followUpAt && now > 0 && new Date(lead.followUpAt).getTime() < now;
    const hasBudget = lead.budgetMin != null || lead.budgetMax != null;
    const place = lead.preferredLocation || lead.propertyInterest;
    // Animate only real moves (a new column or position), not shifts of the page around the board.
    return <motion.div key={lead.id} layout="position" layoutId={`lead-card-${lead.id}`} layoutDependency={`${lead.pipelineStageId}:${index}`} transition={spring}
      initial={introDone ? false : { opacity: 0, y: 6 }} animate={{ opacity: draggedId === lead.id ? 0.45 : 1, y: 0 }}
      {...(!introDone && { transition: { ...spring, opacity: { duration: 0.2, delay: Math.min(index, 8) * 0.03 }, y: { duration: 0.2, delay: Math.min(index, 8) * 0.03 } } })}>
      <article data-lead-id={lead.id} draggable={movable && !pending} onDragStart={event => {
        if (!movable || pending) { event.preventDefault(); return; }
        event.dataTransfer.setData("application/x-estateos-lead", lead.id);
        event.dataTransfer.effectAllowed = "move";
        setDraggedId(lead.id);
      }} onDragEnd={() => { setDraggedId(null); setOverStageId(null); }}
        className={cn("group relative rounded-md border bg-card p-2.5 shadow-[0_1px_1px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-sm", movable && !pending && "cursor-grab active:cursor-grabbing")}>
        <div className="flex items-start gap-2">
          <LeadAvatar name={lead.fullName} className="size-6 text-[10px]" />
          <div className="min-w-0 flex-1">
            <Link href={`/leads/${lead.id}`} draggable={false} className="block truncate text-[13px] leading-5 font-medium hover:underline">{lead.fullName}</Link>
            <p className="truncate text-[11px] text-muted-foreground">{lead.phone || lead.email || "No contact details"}</p>
          </div>
          {!movable && <span title={lead.archivedAt ? "Archived" : terminal(lead) ? "Final stage" : "Stage setup required"} className="mt-1 text-muted-foreground"><LockKeyhole className="size-3" aria-hidden="true" /><span className="sr-only">{lead.archivedAt ? "Archived" : terminal(lead) ? "Final stage" : "Stage setup required"}</span></span>}
          <DropdownMenu>
            <DropdownMenuTrigger data-testid="lead-move" disabled={pending} render={<Button variant="ghost" size="icon-xs" className="-mt-0.5 -mr-1 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 md:data-[popup-open]:opacity-100" aria-label={`Actions for ${lead.fullName}`} />}>
              <MoreHorizontal aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem render={<Link href={`/leads/${lead.id}`} />}><ExternalLink aria-hidden="true" />Open lead</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{movable ? "Move to stage" : lead.archivedAt ? "Archived leads cannot move" : terminal(lead) ? "Final stage reached" : "Open the lead to set its stage"}</DropdownMenuLabel>
                {movable && <DropdownMenuRadioGroup value={lead.pipelineStageId || ""} onValueChange={value => moveLead(lead.id, String(value))}>
                  {stages.filter(stage => stage.pipelineId === lead.pipelineId).map(stage => <DropdownMenuRadioItem key={stage.id} value={stage.id}>
                    <span className={cn("size-2 rounded-full", STATUS_DOTS[stage.status as keyof typeof STATUS_DOTS] ?? "bg-slate-400")} aria-hidden="true" />{stage.name}
                  </DropdownMenuRadioItem>)}
                </DropdownMenuRadioGroup>}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {(hasBudget || place) && <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          {hasBudget && <span className="font-medium tabular-nums">{leadBudget(lead)}</span>}
          {hasBudget && place && <span className="text-muted-foreground/60">·</span>}
          {place && <span className="flex min-w-0 items-center gap-1 text-muted-foreground"><MapPin className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{place}</span></span>}
        </div>}
        {lead.origin && lead.origin.channel !== "MANUAL" && <div className="mt-1.5 [&_span]:text-[11px]" title={lead.origin.campaign ?? undefined}><LeadChannelTag origin={lead.origin} compact /></div>}
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">{agent ? <><LeadAvatar name={agent} className="size-4 border-0 text-[8px]" /><span className="truncate">{agent}</span></> : <span className="italic">Unassigned</span>}</span>
          <span className="flex shrink-0 items-center gap-2">
            {(lead.priority === "HIGH" || lead.priority === "URGENT") && <span className={cn("flex items-center gap-0.5", lead.priority === "URGENT" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}><Flag className="size-3" aria-hidden="true" />{lead.priority === "URGENT" ? "Urgent" : "High"}</span>}
            {lead.followUpAt && <span className={cn("flex items-center gap-1", overdue && "font-medium text-red-600 dark:text-red-400")}><CalendarClock className="size-3" aria-hidden="true" /><time dateTime={lead.followUpAt}>{formatLeadDate(lead.followUpAt).replace(/ \d{4}$/, "")}</time>{overdue && <span className="sr-only">(overdue)</span>}</span>}
          </span>
        </div>
      </article>
    </motion.div>;
  }

  return <MotionConfig reducedMotion="user">
    <section aria-label="Lead Kanban pipeline" aria-busy={pending} className="p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-0.5">
        <p id="kanban-help" className="text-[11px] text-muted-foreground">Drag a card to another stage, or use its menu. Columns show this page of results.</p>
        {pending && <span className="inline-flex items-center gap-1.5 text-[11px] text-primary"><Loader2 className="size-3 animate-spin" aria-hidden="true" />Saving…</span>}
      </div>
      {error && <p role="alert" className="mb-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error} The previous stage has been restored.</p>}
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {stages.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No active pipeline is available. Reload or contact your company administrator.</p> : <LayoutGroup>
        <div tabIndex={0} role="region" aria-label="Pipeline columns. Scroll horizontally to see every stage." aria-describedby="kanban-help" className="flex gap-2 overflow-x-auto pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {stages.map(stage => {
            const columnLeads = optimisticLeads.filter(lead => lead.pipelineId === stage.pipelineId && lead.pipelineStageId === stage.id);
            const dragged = optimisticLeads.find(lead => lead.id === draggedId);
            const accepts = !pending && !!dragged && dragged.pipelineId === stage.pipelineId && dragged.pipelineStageId !== stage.id;
            const over = accepts && overStageId === stage.id;
            const value = columnValue(columnLeads);
            return <section key={`${stage.pipelineId}:${stage.id}`} data-stage-id={stage.id} aria-label={`${stage.name} stage`}
              onDragOver={event => { if (accepts) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (overStageId !== stage.id) setOverStageId(stage.id); } }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverStageId(current => current === stage.id ? null : current); }}
              onDrop={event => drop(event, stage)}
              className={cn("flex w-[264px] shrink-0 flex-col rounded-lg border border-transparent bg-muted/50 transition-colors dark:bg-muted/25", accepts && "border-dashed border-foreground/15", over && "border-primary/50 bg-primary/[0.06]")}>
              <header className="flex items-center gap-2 px-2.5 pt-2.5 pb-2">
                <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOTS[stage.status as keyof typeof STATUS_DOTS] ?? "bg-slate-400")} aria-hidden="true" />
                <h3 className="truncate text-xs font-semibold">{stage.name}</h3>
                <span className="text-xs text-muted-foreground tabular-nums">{columnLeads.length}</span>
                {value && <span className="ml-auto text-[11px] text-muted-foreground tabular-nums" title="Sum of the leads' top budgets">{value}</span>}
              </header>
              {data.pipelines.length > 1 && <p className="-mt-1 mb-1.5 px-2.5 text-[10px] text-muted-foreground">{stage.pipelineName}</p>}
              <div className="flex min-h-32 flex-1 flex-col gap-1.5 px-1.5 pb-1.5">
                {columnLeads.map(card)}
                {over && <div className="flex h-12 items-center justify-center rounded-md border border-dashed border-primary/40 text-[11px] text-primary">Move to {stage.name}</div>}
                {!columnLeads.length && !over && <p className="py-6 text-center text-[11px] text-muted-foreground/80">No leads</p>}
              </div>
            </section>;
          })}
          {legacyLeads.length > 0 && <section aria-label="Leads awaiting pipeline setup" className="flex w-[264px] shrink-0 flex-col rounded-lg bg-muted/50 dark:bg-muted/25">
            <header className="flex items-center gap-2 px-2.5 pt-2.5 pb-2"><h3 className="text-xs font-semibold">Awaiting stage setup</h3><span className="text-xs text-muted-foreground tabular-nums">{legacyLeads.length}</span></header>
            <div className="flex flex-col gap-1.5 px-1.5 pb-1.5">{legacyLeads.map(card)}</div>
          </section>}
        </div>
      </LayoutGroup>}
    </section>
  </MotionConfig>;
}
