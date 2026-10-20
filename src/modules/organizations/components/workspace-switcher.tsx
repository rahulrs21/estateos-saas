"use client";

import { useId, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CompanyChoice } from "../types";
import { companyRequest } from "../client";

export function WorkspaceSwitcher({ companies, activeId, compact = false }: { companies: CompanyChoice[]; activeId?: string; compact?: boolean }) {
  const id = useId();
  const [selected, setSelected] = useState(activeId ?? (companies.length === 1 ? companies[0].id : ""));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function switchCompany(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selected || selected === activeId) return;
    setError(""); setPending(true);
    try {
      await companyRequest("/api/organizations/switch", "POST", { organizationId: selected });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard all previous-company router and form state.
      window.location.assign("/workspace/dashboard");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change workspace. Please try again.");
      setPending(false);
    }
  }
  if (!companies.length) return <p className="text-sm text-muted-foreground">You have no active company memberships.</p>;
  return <form onSubmit={switchCompany} aria-busy={pending} className="w-full min-w-0 space-y-2">
    <label htmlFor={id} className={compact ? "text-[11px] font-medium text-muted-foreground" : "text-sm font-medium"}>Company workspace</label>
    <select id={id} value={selected} onChange={event => setSelected(event.target.value)} disabled={pending} aria-describedby={error ? id + "-error" : undefined} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60">
      <option value="" disabled>Select a company</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name} · {company.role.toLowerCase()}</option>)}
    </select>
    {(companies.length > 1 || !activeId) && <Button type="submit" variant="outline" size={compact ? "sm" : "default"} className="w-full" disabled={pending || !selected || selected === activeId}>{pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}{pending ? "Switching…" : "Open workspace"}</Button>}
    {pending && <p role="status" className="text-xs text-muted-foreground">Opening your company dashboard…</p>}
    {error && <p id={id + "-error"} role="alert" className="text-xs leading-5 text-destructive">{error}</p>}
  </form>;
}
