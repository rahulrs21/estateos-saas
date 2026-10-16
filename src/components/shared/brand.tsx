import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span aria-hidden="true" className="flex size-9 shrink-0 items-end justify-center gap-0.5 rounded-[10px] bg-primary p-2 text-primary-foreground">
        <span className="h-3 w-1 rounded-t-sm bg-current" />
        <span className="h-5 w-1 rounded-t-sm bg-current" />
        <span className="h-4 w-1 rounded-t-sm bg-current" />
      </span>
      {!compact && <span className="text-xl font-semibold tracking-[-0.7px] text-foreground">Estate<span className="text-primary">OS</span></span>}
      {compact && <span className="sr-only">EstateOS</span>}
    </span>
  );
}
