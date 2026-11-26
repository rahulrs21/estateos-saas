import { OTHER_LABEL } from "./dashboard-model";

/*
 * Categorical colours for part-to-whole charts: the validated --series-1..5
 * palette (light and dark values in globals.css) in fixed order, and a
 * neutral grey for "Other". Shared by server-rendered legends and the
 * client-rendered donut, so it must not live in a "use client" module.
 */
const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];

export function sliceColor(label: string, index: number) {
  return label === OTHER_LABEL ? "var(--series-other)" : SERIES[index % SERIES.length];
}
