import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function KpiCard({ title, description, icon: Icon, unit }: { title: string; description: string; icon: LucideIcon; unit?: string }) {
  return (
    <Card className="rounded-xl shadow-xs ring-border">
      <CardContent className="px-5 py-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-medium text-muted-foreground">{title}</h2>
          <span className="flex size-8 items-center justify-center rounded-lg bg-secondary text-primary"><Icon className="size-4" aria-hidden="true" /></span>
        </div>
        <p className="mt-3 flex items-baseline gap-1.5 text-[32px] leading-none font-semibold tracking-tight" aria-label={`${title}: data not connected`}><span aria-hidden="true">—</span>{unit && <span className="text-xs font-medium tracking-normal text-muted-foreground" aria-hidden="true">{unit}</span>}</p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
