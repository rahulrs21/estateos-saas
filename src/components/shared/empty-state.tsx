import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({ icon: Icon, title, description, children, className }: { icon: LucideIcon; title: string; description: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-5 py-10 text-center", className)}>
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{description}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}
