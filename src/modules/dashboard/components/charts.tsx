"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ReferenceDot, XAxis, YAxis } from "recharts";
import { useReducedMotion } from "motion/react";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { VolumeBucket, VolumePoint } from "../dashboard-model";
import { sliceColor } from "../series-colors";

/*
 * Charts follow docs in the dataviz method: one axis per chart, a recessive
 * grid, thin marks and a tooltip on hover. Single-series charts use the
 * primary chart colour; the sources donut uses the validated --series-1..5
 * palette (light and dark values in globals.css) with "Other" in neutral grey,
 * and its legend labels every slice in text.
 */

const leadsConfig = {count: {label: "Leads", color: "var(--chart-1)"}} satisfies ChartConfig;

const dayFormat = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", timeZone: "UTC"});
const monthFormat = new Intl.DateTimeFormat("en-AE", {month: "short", year: "2-digit", timeZone: "UTC"});
const longDay = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "UTC"});
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);

function bucketLabel(date: string, bucket: VolumeBucket) {
  return bucket === "month" ? monthFormat.format(asDate(date)) : dayFormat.format(asDate(date));
}
function bucketTitle(date: string, bucket: VolumeBucket) {
  return bucket === "month" ? new Intl.DateTimeFormat("en-AE", {month: "long", year: "numeric", timeZone: "UTC"}).format(asDate(date))
    : bucket === "week" ? `Week of ${longDay.format(asDate(date))}` : longDay.format(asDate(date));
}

export function LeadVolumeChart({data, bucket}: {data: VolumePoint[]; bucket: VolumeBucket}) {
  const reduce = useReducedMotion();
  const total = data.reduce((sum, point) => sum + point.count, 0);
  const peak = data.reduce<VolumePoint | null>((best, point) => !best || point.count > best.count ? point : best, null);
  const summary = `New leads per ${bucket}, ${bucketTitle(data[0]?.date ?? "", bucket)} to ${bucketTitle(data.at(-1)?.date ?? "", bucket)}: ${total} in total${peak && peak.count ? `, highest ${peak.count} in ${bucketTitle(peak.date, bucket)}` : ""}.`;
  return <ChartContainer config={leadsConfig} className="aspect-auto h-64 w-full" role="img" aria-label={summary}>
    <AreaChart data={data} margin={{top: 26, right: 8, bottom: 0, left: -12}} accessibilityLayer>
      <defs>
        <linearGradient id="lead-volume-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.22} />
          <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 4" />
      <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={value => bucketLabel(String(value), bucket)} />
      <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tickMargin={4} />
      <ChartTooltip cursor={{strokeWidth: 1, strokeDasharray: "3 3"}} content={<ChartTooltipContent indicator="dot" labelFormatter={value => bucketTitle(String(value), bucket)} />} />
      <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} fill="url(#lead-volume-fill)"
        activeDot={{r: 5, strokeWidth: 2, stroke: "var(--card)"}} isAnimationActive={!reduce} animationDuration={700} />
      {peak && peak.count > 0 && <ReferenceDot x={peak.date} y={peak.count} r={11} fill="var(--color-count)" fillOpacity={0.15} stroke="none" ifOverflow="extendDomain" />}
      {peak && peak.count > 0 && <ReferenceDot x={peak.date} y={peak.count} r={5} fill="var(--color-count)" stroke="var(--card)" strokeWidth={2} ifOverflow="extendDomain"
        label={{value: `${peak.count}`, position: "top", offset: 14, className: "fill-foreground text-xs font-semibold"}} />}
    </AreaChart>
  </ChartContainer>;
}

/** Tiny trend line for a KPI tile; decorative, the tile states the value. */
export function Sparkline({data}: {data: VolumePoint[]}) {
  const reduce = useReducedMotion();
  return <ChartContainer config={leadsConfig} className="aspect-auto h-10 w-20" aria-hidden="true">
    <AreaChart data={data} margin={{top: 2, right: 0, bottom: 2, left: 0}}>
      <defs>
        <linearGradient id="sparkline-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-count)" stopOpacity={0.25} />
          <stop offset="100%" stopColor="var(--color-count)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <Area dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={1.5} fill="url(#sparkline-fill)" dot={false} isAnimationActive={!reduce} animationDuration={700} />
    </AreaChart>
  </ChartContainer>;
}


/** Part-to-whole donut with the total in the centre. The legend beside it carries every label and value. */
export function SourcesDonut({slices, total}: {slices: Array<{label: string; count: number; percent: number}>; total: number}) {
  const reduce = useReducedMotion();
  const config = Object.fromEntries(slices.map((slice, index) => [`s${index}`, {label: slice.label, color: sliceColor(slice.label, index)}])) satisfies ChartConfig;
  const data = slices.map((slice, index) => ({...slice, key: `s${index}`, fill: sliceColor(slice.label, index)}));
  return <div className="relative size-40 shrink-0">
    <ChartContainer config={config} className="aspect-square size-40" role="img" aria-label={`Lead sources: ${slices.map(slice => `${slice.label} ${slice.count} (${slice.percent}%)`).join(", ")}.`}>
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="key" />} />
        <Pie data={data} dataKey="count" nameKey="key" innerRadius={50} outerRadius={78} paddingAngle={slices.length > 1 ? 2 : 0} cornerRadius={3} strokeWidth={0}
          startAngle={90} endAngle={-270} isAnimationActive={!reduce} animationDuration={700}>
          {data.map(slice => <Cell key={slice.key} fill={slice.fill} />)}
        </Pie>
      </PieChart>
    </ChartContainer>
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
      <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString("en-AE")}</span>
      <span className="text-[11px] text-muted-foreground">Total</span>
    </div>
  </div>;
}

const stageConfig = {count: {label: "Leads", color: "var(--chart-1)"}} satisfies ChartConfig;

/** A stage name under its column, wrapped onto at most two lines so neighbouring names never overlap. */
function StageTick({x, y, payload}: {x?: number | string; y?: number | string; payload?: {value?: string}}) {
  const words = String(payload?.value ?? "").split(/\s+/);
  const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
  const clip = (text: string) => text.length > 11 ? `${text.slice(0, 10)}…` : text;
  return <text x={Number(x)} y={Number(y) + 12} textAnchor="middle" className="fill-muted-foreground" fontSize={11}>
    {lines.map((line, index) => <tspan key={index} x={Number(x)} dy={index ? 13 : 0}>{clip(line)}</tspan>)}
  </text>;
}

/** Leads per pipeline stage as columns in pipeline order, with the count above each column. */
export function PipelineColumns({data}: {data: Array<{label: string; count: number}>}) {
  const reduce = useReducedMotion();
  const summary = `Leads by stage: ${data.map(row => `${row.label} ${row.count}`).join(", ")}.`;
  return <ChartContainer config={stageConfig} className="aspect-auto h-56 w-full" role="img" aria-label={summary}>
    <BarChart data={data} margin={{top: 22, right: 4, bottom: 0, left: 4}} barCategoryGap="22%" accessibilityLayer>
      <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} height={40} tick={<StageTick />} />
      <YAxis hide allowDecimals={false} />
      <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
      <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 2, 2]} maxBarSize={44} isAnimationActive={!reduce} animationDuration={600}>
        <LabelList dataKey="count" position="top" offset={6} className="fill-foreground tabular-nums" fontSize={12} />
      </Bar>
    </BarChart>
  </ChartContainer>;
}
