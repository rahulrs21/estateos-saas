"use client";

import { useState } from "react";
import { FilePlus2, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { automationsSend, errorMessage } from "../client";
import type { WorkflowProposal } from "../ai";
import type { WorkflowDefinitionInput } from "../definition";
import { actionLabel, describeTrigger } from "../describe";
import { WORKFLOW_TEMPLATES, templateByKey } from "../templates";
import { WorkflowEditor } from "./workflow-editor";

const BLANK: WorkflowDefinitionInput = {
  schemaVersion: 1, name: "New workflow", description: "", trigger: "lead.created", conditions: null,
  steps: [{id: "notify", type: "notification.create", audience: "ASSIGNEE", title: "New lead: {{lead.fullName}}", message: "Please review {{lead.fullName}}.", when: null}],
};

function ProposalNotes({proposal}: {proposal: WorkflowProposal & {model: string}}) {
  const groups = [
    {title: "Not possible in a workflow", items: proposal.unsupported, tone: "text-amber-900 dark:text-amber-200"},
    {title: "Left out by EstateOS", items: proposal.rejected, tone: "text-amber-900 dark:text-amber-200"},
    {title: "Claude assumed", items: proposal.assumptions, tone: "text-muted-foreground"},
  ].filter(group => group.items.length);
  return <section className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm" aria-labelledby="proposal-title">
    <h2 id="proposal-title" className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" aria-hidden="true" />Draft proposed by Claude</h2>
    <p className="text-muted-foreground">Review every step. Nothing is saved until you save it, and it runs only after review, approval and activation. Risk and approval needs come from EstateOS, not from Claude.</p>
    {groups.map(group => <div key={group.title}><p className="font-medium">{group.title}</p><ul className={`list-disc pl-5 ${group.tone}`}>{group.items.map(item => <li key={item}>{item}</li>)}</ul></div>)}
  </section>;
}

function DescribeToClaude({organizationId, onProposal}: {organizationId: string; onProposal: (proposal: WorkflowProposal & {model: string}) => void}) {
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Dubai";
      onProposal(await automationsSend<WorkflowProposal & {model: string}>("/api/automations/generate", organizationId, "POST", {description, timeZone}, "Claude could not draft this workflow."));
    } catch (error) { toast.error(errorMessage(error, "Claude could not draft this workflow.")); } finally { setBusy(false); }
  };
  return <section className="space-y-3 rounded-xl border bg-card p-4" aria-labelledby="describe-title">
    <h2 id="describe-title" className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" aria-hidden="true" />Describe it to Claude</h2>
    <div className="space-y-1.5">
      <Label htmlFor="wf-describe">What should happen?</Label>
      <textarea id="wf-describe" className="min-h-24 w-full rounded-lg border bg-background px-2.5 py-2 text-sm" maxLength={2000} value={description} onChange={event => setDescription(event.target.value)}
        placeholder="For example: when a website lead is assigned and nobody contacts them within 2 hours, tell the managers." />
      <p className="text-xs text-muted-foreground">Uses one request of your AI allowance. Claude sees this description and the list of allowed triggers and actions, not your CRM records.</p>
    </div>
    <Button onClick={generate} disabled={busy || description.trim().length < 10}>{busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}Draft with Claude</Button>
  </section>;
}

/** Choose a starting point; nothing is saved until the editor saves a draft. */
export function NewWorkflow({organizationId, agents, initialTemplate, aiEnabled}: {organizationId: string; agents: Array<{id: string; name: string}>; initialTemplate?: string | null; aiEnabled: boolean}) {
  const [start, setStart] = useState<WorkflowDefinitionInput | null>(() => {
    const template = initialTemplate ? templateByKey(initialTemplate) : null;
    return template ? structuredClone(template.definition) : null;
  });
  const [proposal, setProposal] = useState<(WorkflowProposal & {model: string}) | null>(null);
  if (start) return <div className="space-y-4">
    {proposal && <ProposalNotes proposal={proposal} />}
    <WorkflowEditor organizationId={organizationId} initial={start} agents={agents} />
  </div>;
  return <div className="space-y-4">
    {aiEnabled && <DescribeToClaude organizationId={organizationId} onProposal={result => { setProposal(result); setStart(result.definition); }} />}
    <section aria-labelledby="templates-title" className="space-y-3">
      <h2 id="templates-title" className="flex items-center gap-2 font-semibold"><LayoutTemplate className="size-4" aria-hidden="true" />Start from a template</h2>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOW_TEMPLATES.map(template => <li key={template.key}>
          <button type="button" onClick={() => setStart(structuredClone(template.definition))}
            className="flex h-full w-full flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
            <span className="flex items-center gap-2"><Badge variant="outline">{template.key}</Badge><span className="font-medium">{template.title}</span></span>
            <span className="text-sm text-muted-foreground">{template.summary}</span>
            <span className="text-xs text-muted-foreground">When: {describeTrigger(template.definition)} · {template.definition.steps.map(step => actionLabel(step.type)).join(" → ")}</span>
            {template.setup.map(note => <span key={note} className="text-xs text-amber-800 dark:text-amber-300">{note}</span>)}
          </button>
        </li>)}
      </ul>
    </section>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
      <p className="text-sm text-muted-foreground">Or build your own from the allowed triggers and actions.</p>
      <Button variant="outline" onClick={() => setStart(structuredClone(BLANK))}><FilePlus2 aria-hidden="true" />Start blank</Button>
    </div>
  </div>;
}
