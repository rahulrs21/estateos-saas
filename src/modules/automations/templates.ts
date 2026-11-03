import type { WorkflowDefinitionInput } from "./definition";

/*
 * Starting points for new workflows (docs/WORKFLOW_BUILDER.md#templates).
 * A template is an ordinary definition: it is validated like any other, saved
 * as a draft in the company that uses it, and goes through review and approval
 * before it runs. None contains an external message, publishing or a financial
 * or destructive action; Claude steps only prepare internal drafts.
 */

export interface WorkflowTemplate {
  key: "A" | "B" | "C" | "D" | "E" | "F";
  title: string;
  summary: string;
  /** What to check before activating; shown with the template. */
  setup: string[];
  definition: WorkflowDefinitionInput;
}

export const WORKFLOW_TEMPLATES: readonly WorkflowTemplate[] = [
  {
    key: "A", title: "New lead assignment", summary: "Assigns new leads with your approved distribution rules, notifies the agent and creates a follow-up.",
    setup: ["Enable round-robin distribution in Settings → Lead distribution, or leads stay in the unassigned queue."],
    definition: {
      schemaVersion: 1, name: "New lead assignment", description: "Assign each new lead, tell the agent and create a first call task.", trigger: "lead.created",
      steps: [
        {id: "assign", type: "lead.distribute"},
        {id: "notify-agent", type: "notification.create", audience: "ASSIGNEE", title: "New lead: {{lead.fullName}}", message: "{{lead.fullName}} was assigned to you. Make first contact today."},
        {id: "first-call", type: "task.create", title: "First call with {{lead.fullName}}", dueMinutes: 60, assignee: "ASSIGNEE"},
      ],
    },
  },
  {
    key: "B", title: "Uncontacted lead escalation", summary: "If an assigned lead has had no contact after a waiting period, the managers are told.",
    setup: ["Adjust the waiting period to your response-time target."],
    definition: {
      schemaVersion: 1, name: "Uncontacted lead escalation", description: "Escalate assigned leads that nobody has contacted.", trigger: "lead.assigned",
      steps: [
        {id: "wait", type: "delay", minutes: 240},
        {id: "escalate", type: "notification.create", audience: "MANAGERS", title: "Lead not contacted: {{lead.fullName}}", message: "{{lead.fullName}} has had no contact or completed follow-up since assignment.",
          when: {mode: "AND", conditions: [
            {field: "lead.archived", operator: "eq", value: false},
            {field: "lead.contacted", operator: "eq", value: false},
            {field: "lead.followupCompleted", operator: "eq", value: false},
          ]}},
      ],
    },
  },
  {
    key: "C", title: "Viewing follow-up", summary: "After a completed viewing, creates a follow-up and prepares an editable message draft for the agent.",
    setup: ["The draft is saved in Content Studio for the agent to edit; nothing is sent."],
    definition: {
      schemaVersion: 1, name: "Viewing follow-up", description: "Follow up every completed viewing.", trigger: "viewing.completed",
      steps: [
        {id: "follow-up", type: "viewing.followup", title: "Follow up the viewing with {{lead.fullName}}", dueMinutes: 1440},
        {id: "draft", type: "ai.draft", contentType: "WHATSAPP_MESSAGE", instructions: "A short, friendly thank-you for attending the viewing, asking for their impressions and offering next steps."},
      ],
    },
  },
  {
    key: "D", title: "New property listing", summary: "Tells the managers about each new listing and queues a review task for the team.",
    setup: [],
    definition: {
      schemaVersion: 1, name: "New property listing review", description: "Review every new listing before it is marketed.", trigger: "listing.created",
      steps: [
        {id: "notify-managers", type: "notification.create", audience: "MANAGERS", title: "New listing: {{listing.title}}", message: "{{listing.title}} was created and needs a review."},
        {id: "review", type: "task.create", title: "Review listing {{listing.title}}", dueMinutes: 1440, assignee: "UNASSIGNED"},
      ],
    },
  },
  {
    key: "E", title: "Overdue follow-ups", summary: "When a pending follow-up passes its due time, reminds the agent and, if it stays open, the managers.",
    setup: ["Quiet hours hold reminders until the morning."],
    definition: {
      schemaVersion: 1, name: "Overdue follow-up reminders", description: "Chase follow-ups that are past due.", trigger: "lead.followup_due",
      conditions: {field: "task.status", operator: "eq", value: "PENDING"},
      quietHours: {start: "21:00", end: "08:00"},
      steps: [
        {id: "remind-agent", type: "notification.create", audience: "ASSIGNEE", title: "Follow-up overdue: {{lead.fullName}}", message: "Your follow-up with {{lead.fullName}} is overdue."},
        {id: "wait", type: "delay", minutes: 1440},
        {id: "tell-managers", type: "notification.create", audience: "MANAGERS", title: "Follow-up still overdue: {{lead.fullName}}", message: "A follow-up with {{lead.fullName}} has been overdue for a day.",
          when: {field: "lead.followupCompleted", operator: "eq", value: false}},
      ],
    },
  },
  {
    key: "F", title: "AI sales review", summary: "On request, runs the existing AI sales analysis for a lead and saves it as an internal insight.",
    setup: ["Uses your company's AI allowance. Run it from the workflow page, for one lead at a time."],
    definition: {
      schemaVersion: 1, name: "AI sales review", description: "An internal sales analysis of a lead, on request.", trigger: "workflow.manual",
      steps: [
        {id: "review", type: "ai.sales_review"},
        {id: "note", type: "lead.activity", note: "AI sales review requested for {{lead.fullName}}; see the AI insights panel."},
      ],
    },
  },
];

export const templateByKey = (key: string) => WORKFLOW_TEMPLATES.find(template => template.key === key) ?? null;
