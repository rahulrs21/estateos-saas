import type { Condition, ConditionValue, Placeholder } from "./definition";
import { PLACEHOLDERS } from "./definition";

/*
 * Condition evaluation over a flat map of facts the engine reads from the
 * database at run time. Pure data comparisons: no expressions, no eval.
 * A missing fact counts as empty; comparisons with the wrong type are false.
 */

export type Facts = Record<string, ConditionValue>;

export function evaluateCondition(condition: Condition | null, facts: Facts, now: Date = new Date()): boolean {
  if (!condition) return true;
  if ("mode" in condition) {
    return condition.mode === "AND" ? condition.conditions.every(child => evaluateCondition(child, facts, now)) : condition.conditions.some(child => evaluateCondition(child, facts, now));
  }
  const current = Object.hasOwn(facts, condition.field) ? facts[condition.field] : null;
  const empty = current === null || current === "";
  const expected = condition.value;
  switch (condition.operator) {
    case "empty": return empty;
    case "not_empty": return !empty;
    case "eq": return !empty && current === expected;
    case "ne": return empty ? expected !== null : current !== expected;
    case "contains": return typeof current === "string" && typeof expected === "string" && current.toLowerCase().includes(expected.toLowerCase());
    case "gt": return typeof current === "number" && typeof expected === "number" && current > expected;
    case "lt": return typeof current === "number" && typeof expected === "number" && current < expected;
    case "before": case "after": {
      if (typeof current !== "string" || typeof expected !== "string") return false;
      const actual = Date.parse(current), target = Date.parse(expected);
      return Number.isFinite(actual) && Number.isFinite(target) && (condition.operator === "before" ? actual < target : actual > target);
    }
    case "within_minutes": {
      if (typeof current !== "string" || typeof expected !== "number") return false;
      const actual = Date.parse(current);
      return Number.isFinite(actual) && actual <= now.getTime() && now.getTime() - actual <= expected * 60_000;
    }
  }
}

/** Fills the allowlisted {{placeholders}} with plain text (unknown or missing ones become empty). */
export function fillPlaceholders(text: string, values: Partial<Record<Placeholder, string | null>>): string {
  return text.replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, name: string) => (PLACEHOLDERS as readonly string[]).includes(name) ? (values[name as Placeholder] ?? "") : "")
    .replace(/[<>]/g, "").replace(/\s{2,}/g, " ").trim();
}
