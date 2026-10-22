export type DistributionAgent = {
  id: string;
  role: string;
  status: string;
  userProfileUid: string | null;
  availability?: { status: string; unavailableUntil?: string | null } | null;
};

export type DistributionRulePolicy = {
  enabled: boolean;
  mode: "MANUAL" | "ROUND_ROBIN";
  branchId: string | null;
  projectId: string | null;
  skipUnavailable: boolean;
  businessHoursEnabled: boolean;
  timeZone: string;
  businessDaysMask: number;
  businessStart: string;
  businessEnd: string;
};

export function matchesDistributionScope(
  rule: Pick<DistributionRulePolicy, "branchId" | "projectId">,
  lead: { branchId?: string | null; projectId?: string | null },
): boolean {
  return (!rule.branchId || rule.branchId === lead.branchId) &&
    (!rule.projectId || rule.projectId === lead.projectId);
}

function parseClock(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function isWithinBusinessHours(
  rule: Pick<DistributionRulePolicy, "businessHoursEnabled" | "timeZone" | "businessDaysMask" | "businessStart" | "businessEnd">,
  at: Date,
): boolean {
  if (!rule.businessHoursEnabled) return true;
  const start = parseClock(rule.businessStart);
  const end = parseClock(rule.businessEnd);
  if (start === null || end === null || end <= start || !Number.isFinite(at.getTime())) return false;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: rule.timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(at);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday ?? "");
    const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
    return weekday >= 0 && (rule.businessDaysMask & (1 << weekday)) !== 0 && minuteOfDay >= start && minuteOfDay < end;
  } catch {
    return false;
  }
}

export function selectNextDistributionAgent<T extends DistributionAgent>(
  agents: readonly T[],
  lastMembershipId: string | null,
  skipUnavailable: boolean,
  at: Date = new Date(),
): T | null {
  const eligible = agents
    .filter((agent) => agent.role === "AGENT" && agent.status === "ACTIVE" && Boolean(agent.userProfileUid))
    .filter((agent) => !skipUnavailable || (
      agent.availability?.status !== "UNAVAILABLE" ||
      (agent.availability.unavailableUntil != null && Date.parse(agent.availability.unavailableUntil) <= at.getTime())
    ))
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id));
  if (eligible.length === 0) return null;
  const previous = eligible.findIndex((agent) => agent.id === lastMembershipId);
  if (previous >= 0) return eligible[(previous + 1) % eligible.length];
  if (!lastMembershipId) return eligible[0];
  return eligible.find((agent) => agent.id.localeCompare(lastMembershipId) > 0) ?? eligible[0];
}

export type DistributionPlan =
  | { attempted: false; reason: "DISABLED" | "MANUAL_MODE" | "SCOPE_MISMATCH" }
  | { attempted: true; membershipId: string | null; reason: "ASSIGNED" | "OUTSIDE_BUSINESS_HOURS" | "NO_ELIGIBLE_AGENT" };

export function buildDistributionPlan<T extends DistributionAgent>(args: {
  rule: DistributionRulePolicy | null;
  lead: { branchId?: string | null; projectId?: string | null };
  agents: readonly T[];
  lastMembershipId: string | null;
  at?: Date;
}): DistributionPlan {
  const { rule, lead } = args;
  if (!rule?.enabled) return { attempted: false, reason: "DISABLED" };
  if (rule.mode !== "ROUND_ROBIN") return { attempted: false, reason: "MANUAL_MODE" };
  if (!matchesDistributionScope(rule, lead)) return { attempted: false, reason: "SCOPE_MISMATCH" };
  const at = args.at ?? new Date();
  if (!isWithinBusinessHours(rule, at)) return { attempted: true, membershipId: null, reason: "OUTSIDE_BUSINESS_HOURS" };
  const next = selectNextDistributionAgent(args.agents, args.lastMembershipId, rule.skipUnavailable, at);
  return next
    ? { attempted: true, membershipId: next.id, reason: "ASSIGNED" }
    : { attempted: true, membershipId: null, reason: "NO_ELIGIBLE_AGENT" };
}
