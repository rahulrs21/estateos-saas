import Link from "next/link";
import { CircleAlert, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { WorkspaceError } from "@/modules/organizations/server/errors";

export function InventoryAccessState({error, backHref = "/workspace/dashboard"}: {error: WorkspaceError; backHref?: string}) {
  const title = error.code === "SQL_CONNECT_ROLLOUT_REQUIRED"
    ? "Inventory database needs an update"
    : error.code === "VALIDATION_ERROR" ? "Check inventory filters"
    : error.status === 403 ? "Inventory access is restricted" : error.status === 404 ? "Record not found" : "Inventory could not be loaded";
  return <section className="mx-auto flex min-h-[45vh] max-w-xl flex-col items-center justify-center px-5 py-12 text-center" role="alert">
    <span className="mb-4 flex size-12 items-center justify-center rounded-xl border bg-card text-destructive"><CircleAlert className="size-5" aria-hidden="true" /></span>
    <p className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">Inventory</p>
    <h1 className="mt-2 text-xl font-semibold">{title}</h1>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">{error.message}</p>
    <Link href={backHref} className={`${buttonVariants({variant: "outline"})} mt-5`}><ArrowLeft aria-hidden="true" />Back to inventory</Link>
  </section>;
}

export function InventoryEmptyState({icon: Icon, title, description, action}: {icon?: LucideIcon; title: string; description: string; action?: ReactNode}) {
  return <div className="rounded-xl border border-dashed bg-card/40 px-5 py-12 text-center">
    {Icon && <span className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl border bg-background text-muted-foreground"><Icon className="size-5" aria-hidden="true" /></span>}
    <h2 className="text-sm font-semibold">{title}</h2>
    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>;
}

export function InventoryPagination({basePath, page, total, limit, query = ""}: {basePath: string; page: number; total: number; limit: number; query?: string}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const href = (number: number) => `${basePath}?${query ? `${query}&` : ""}page=${number}`;
  return <nav className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground" aria-label="Pagination">
    <span>{total} {total === 1 ? "record" : "records"} · Page {page} of {pages}</span>
    <div className="flex gap-2">
      {page > 1 ? <Link className={buttonVariants({variant: "outline", size: "sm"})} href={href(page - 1)}>Previous</Link> : <Button variant="outline" size="sm" disabled>Previous</Button>}
      {page < pages ? <Link className={buttonVariants({variant: "outline", size: "sm"})} href={href(page + 1)}>Next</Link> : <Button variant="outline" size="sm" disabled>Next</Button>}
    </div>
  </nav>;
}
