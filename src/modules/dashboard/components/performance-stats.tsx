import type { Change, VolumeBucket, VolumePoint } from "../dashboard-model";
import { ChangeBadge } from "./kpi-card";

const integer = new Intl.NumberFormat("en-AE");
const oneDecimal = new Intl.NumberFormat("en-AE", {maximumFractionDigits: 1});
const dayFormat = new Intl.DateTimeFormat("en-AE", {day: "numeric", month: "short", timeZone: "UTC"});
const monthFormat = new Intl.DateTimeFormat("en-AE", {month: "short", year: "numeric", timeZone: "UTC"});

/**
 * Four plain figures above the lead chart, all computed from the same series
 * the chart draws: total, average per bucket, the busiest bucket and the
 * change vs the previous period.
 */
export function PerformanceStats({volume, bucket, total, change, rangeLabel}: {
  volume: VolumePoint[]; bucket: VolumeBucket; total: number; change: Change; rangeLabel: string;
}) {
  const peak = volume.reduce<VolumePoint | null>((best, point) => !best || point.count > best.count ? point : best, null);
  const average = volume.length ? total / volume.length : 0;
  const unit = bucket === "month" ? "month" : bucket === "week" ? "week" : "day";
  const when = peak ? (bucket === "month" ? monthFormat : dayFormat).format(new Date(`${peak.date}T00:00:00Z`)) : "";
  const items = [
    {label: "Total new leads", value: integer.format(total), note: null},
    {label: `Average per ${unit}`, value: oneDecimal.format(average), note: null},
    {label: `Best ${unit}`, value: peak && peak.count ? integer.format(peak.count) : "—", note: peak && peak.count ? (bucket === "week" ? `week of ${when}` : when) : null},
  ];
  return <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
    {items.map(item => <div key={item.label} className="bg-card px-4 py-2.5">
      <dt className="text-[11px] font-medium text-muted-foreground">{item.label}</dt>
      <dd className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tracking-tight tabular-nums">{item.value}</span>
        {item.note && <span className="truncate text-xs text-muted-foreground">{item.note}</span>}
      </dd>
    </div>)}
    <div className="bg-card px-4 py-2.5">
      <dt className="text-[11px] font-medium text-muted-foreground">Vs previous {rangeLabel}</dt>
      <dd className="mt-1.5 text-xs leading-5"><ChangeBadge change={change} period={rangeLabel} compact /></dd>
    </div>
  </dl>;
}
