"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { VolumeBucket, VolumePoint } from "../dashboard-model";

/*
 * Single-series charts in the primary chart colour (--chart-1, contrast-checked
 * on light and dark cards). One axis per chart, a recessive grid, thin marks
 * and a tooltip on hover. Each chart carries an aria-label summary, and the
 * card around it states the total in text.
 */

const leadsConfig = {count: {label: "Leads", color: "var(--chart-1)"}} satisfies ChartConfig;

const shortDate = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", timeZone: "UTC"});
const formatDate = (date: string) => shortDate.format(new Date(`${date}T00:00:00Z`));

export function LeadVolumeChart({data, bucket}: {data: VolumePoint[]; bucket: VolumeBucket}) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const peak = data.reduce<VolumePoint | null>((best, point) => !best || point.count > best.count ? point : best, null);
  const summary = `New leads per ${bucket}, ${formatDate(data[0]?.date ?? "")} to ${formatDate(data.at(-1)?.date ?? "")}: ${total} in total${peak && peak.count ? `, peak of ${peak.count} ${bucket === "week" ? "in the week of" : "on"} ${formatDate(peak.date)}` : ""}.`;
  return <ChartContainer config={leadsConfig} className="aspect-auto h-60 w-full" role="img" aria-label={summary}>
    <AreaChart data={data} margin={{top: 8, right: 4, bottom: 0, left: -12}} accessibilityLayer>
      <CartesianGrid vertical={false} strokeDasharray="0" />
      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={formatDate} />
      <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tickMargin={4} />
      <ChartTooltip cursor={{strokeWidth: 1}} content={<ChartTooltipContent indicator="line" labelFormatter={value => bucket === "week" ? `Week of ${formatDate(String(value))}` : formatDate(String(value))} />} />
      <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} fill="var(--color-count)" fillOpacity={0.08}
        activeDot={{r: 4, strokeWidth: 2, stroke: "var(--card)"}} isAnimationActive={!reduce} animationDuration={600} />
    </AreaChart>
  </ChartContainer>;
}

/** Tiny trend line for a KPI tile; decorative, the tile states the value. */
export function Sparkline({data}: {data: VolumePoint[]}) {
  const reduce = useReducedMotion();
  return <ChartContainer config={leadsConfig} className="aspect-auto h-9 w-24" aria-hidden="true">
    <AreaChart data={data} margin={{top: 2, right: 0, bottom: 2, left: 0}}>
      <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={1.5} fill="var(--color-count)" fillOpacity={0.08} dot={false} isAnimationActive={!reduce} animationDuration={600} />
    </AreaChart>
  </ChartContainer>;
}

const stageConfig = {count: {label: "Leads", color: "var(--chart-1)"}} satisfies ChartConfig;

/** Leads per pipeline stage as horizontal bars, in pipeline order, with the count at each bar's end. */
export function PipelineChart({data}: {data: Array<{label: string; count: number}>}) {
  const reduce = useReducedMotion();
  const summary = `Leads by stage: ${data.map(row => `${row.label} ${row.count}`).join(", ")}.`;
  return <ChartContainer config={stageConfig} className="aspect-auto w-full" style={{height: Math.max(120, data.length * 36 + 8)}} role="img" aria-label={summary}>
    <BarChart data={data} layout="vertical" margin={{top: 0, right: 36, bottom: 0, left: 0}} barCategoryGap={8} accessibilityLayer>
      <XAxis type="number" hide allowDecimals={false} />
      <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={124} tickMargin={8}
        tickFormatter={(value: string) => value.length > 18 ? `${value.slice(0, 17)}…` : value} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
      <Bar dataKey="count" fill="var(--color-count)" radius={4} maxBarSize={20} isAnimationActive={!reduce} animationDuration={500}>
        <LabelList dataKey="count" position="right" offset={8} className="fill-foreground tabular-nums" fontSize={12} />
      </Bar>
    </BarChart>
  </ChartContainer>;
}
