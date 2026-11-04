import type { CallDirection, CallOutcome, CallStatus } from "../model";

/*
 * Simulated call scenarios (developer simulator). Each is the sequence of
 * statuses a provider would report; the simulator applies them one by one with
 * the same state machine and compare-and-set rules as provider webhooks.
 */
export const SCENARIOS = {
  ANSWERED: {label: "Answered and completed", steps: ["RINGING", "IN_PROGRESS", "COMPLETED"], answered: true},
  MISSED: {label: "Rang, nobody answered", steps: ["RINGING", "NO_ANSWER"], answered: false},
  BUSY: {label: "Busy", steps: ["BUSY"], answered: false},
  FAILED: {label: "Failed to connect", steps: ["FAILED"], answered: false},
  DROPPED: {label: "Answered, then dropped", steps: ["RINGING", "IN_PROGRESS", "FAILED"], answered: true},
  RINGING: {label: "Still ringing (in progress)", steps: ["RINGING"], answered: false},
} as const satisfies Record<string, {label: string; steps: readonly CallStatus[]; answered: boolean}>;
export type Scenario = keyof typeof SCENARIOS;
export const SCENARIO_KEYS = Object.keys(SCENARIOS) as Scenario[];

export interface SimulationInput { direction: CallDirection; scenario: Scenario; durationSeconds: number; outcome: CallOutcome | null }

/** The fictional numbers the simulator uses: the UK range reserved for drama (+44 7700 900000-900999), never a real customer. */
export const fictionalNumber = (seed: number) => `+447700900${String(Math.abs(seed) % 1000).padStart(3, "0")}`;
