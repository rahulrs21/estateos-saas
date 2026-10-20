"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, MailPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { companyRequest } from "../client";
import { teamInviteSchema } from "../team-validation";
import { canonicalUuid } from "../server/identifiers";
import { canReinviteRecipient } from "../server/invitation-policy";
import type { getTeamPage } from "../server/team-service";
import type { InvitationDelivery } from "../server/email-delivery";

type Data = Awaited<ReturnType<typeof getTeamPage>>;
const selectStyle = "h-10 min-w-0 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai" }).format(new Date(value));

function DeliveryMessage({ delivery }: { delivery: InvitationDelivery | null }) {
  if (!delivery) return null;
  return <div role={delivery.mode === "failed" ? "alert" : "status"} className="space-y-3 rounded-xl border bg-card p-4">
    <p className="text-sm font-medium">{delivery.mode === "preview" ? "Development preview — email not sent" : delivery.mode === "failed" ? "Delivery not confirmed" : "Invitation created"}</p>
    <p className="text-sm leading-6 text-muted-foreground">{delivery.message}</p>
    {delivery.previewUrl && <div className="space-y-2"><Label htmlFor="invitation-preview">Private invitation link</Label><Input id="invitation-preview" readOnly value={delivery.previewUrl} className="h-10" onFocus={event => event.target.select()} /><p className="text-xs leading-5 text-muted-foreground">Copy this link and open it as the invited user. It grants access only after signing in with the matching verified email.</p></div>}
  </div>;
}

export function TeamSettings({ result }: { result: Data }) {
  const { organization, actor, filters, data } = result;
  const invitations = "invitations" in data;
  const router = useRouter();
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [delivery, setDelivery] = useState<InvitationDelivery | null>(null);
  const [roleDraft, setRoleDraft] = useState<Record<string, string>>({});
  const roles = actor.role === "OWNER" ? ["ADMIN", "MANAGER", "AGENT"] : ["MANAGER", "AGENT"];
  const total = data.total[0]?.count ?? 0;
  const pages = Math.min(401, Math.max(1, Math.ceil(total / 25)));
  const shown = ("memberships" in data ? data.memberships : data.invitations).length;
  const root = invitations ? "/settings/team/invitations" : "/settings/team";
  const pageHref = (page: number) => root + "?" + new URLSearchParams({ search: filters.search, status: filters.status, page: String(page) });

  async function action(path: string, method: "POST" | "PATCH", body: unknown, key: string) {
    if (pending) return;
    setPending(key); setError(""); setSuccess(""); setDelivery(null);
    try {
      const response = await companyRequest<{ delivery?: InvitationDelivery }>(path, method, body, organization.id);
      if (response.delivery) setDelivery(response.delivery);
      else setSuccess("Change saved.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "This change could not be saved."); }
    finally { setPending(""); }
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const parsed = teamInviteSchema.safeParse({ email: fields.get("email"), role: fields.get("role") });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || "Review the invitation fields."); return; }
    await action("/api/team/invitations", "POST", parsed.data, "invite");
  }

  return <div className="space-y-6">
    <PageHeader title={invitations ? "Team invitations" : "Team members"} eyebrow={organization.name} description={invitations ? "Invite colleagues to join your company securely." : "Manage company membership, roles and access."}>
      {!invitations && <Link href="/settings/team/invitations" className="inline-flex items-center gap-2 rounded text-sm font-semibold text-primary"><MailPlus className="size-4" aria-hidden="true" />Invite a team member</Link>}
    </PageHeader>
    {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
    {(pending || success) && <p role="status" className="text-sm text-muted-foreground">{pending ? "Saving team changes…" : success}</p>}
    <DeliveryMessage delivery={delivery} />
    {invitations && <form onSubmit={invite} aria-busy={pending === "invite"} className="space-y-4 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">Invite a team member</h2>
      <fieldset disabled={Boolean(pending)} className="grid min-w-0 gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"><legend className="sr-only">Invitation details</legend>
        <div className="space-y-2"><Label htmlFor="invite-email">Email address</Label><Input id="invite-email" name="email" type="email" required autoComplete="off" maxLength={254} className="h-10" /></div>
        <div className="space-y-2"><Label htmlFor="invite-role">Organization role</Label><select id="invite-role" name="role" defaultValue="AGENT" className={selectStyle}>{roles.map(role => <option key={role}>{role}</option>)}</select></div>
        <Button type="submit" disabled={Boolean(pending)} className="h-10">{pending === "invite" && <LoaderCircle className="animate-spin" aria-hidden="true" />}Create invitation</Button>
      </fieldset><p className="text-xs leading-5 text-muted-foreground">You can invite multiple colleagues before anyone accepts. For an email already listed as pending, use Reissue to create a new link. Each recipient must sign in with their verified email and accept; they do not need to create a company.</p>
    </form>}
    <form action={root} method="get" className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
      <div className="min-w-40 flex-1 space-y-2"><Label htmlFor="team-search">Search {invitations ? "email" : "name or email"}</Label><Input id="team-search" name="search" defaultValue={filters.search} maxLength={120} className="h-10" /></div>
      <div className="space-y-2"><Label htmlFor="team-status">Status</Label><select id="team-status" name="status" defaultValue={filters.status} className={selectStyle}>{(invitations ? ["ALL", "PENDING", "ACCEPTED", "REVOKED"] : ["ALL", "ACTIVE", "SUSPENDED", "PENDING", "REMOVED", "REVOKED"]).map(status => <option key={status}>{status}</option>)}</select></div>
      <Button type="submit" variant="outline" className="h-10">Apply filters</Button>
    </form>
    <section aria-label={invitations ? "Company invitations" : "Company members"} aria-busy={Boolean(pending)} className="overflow-hidden rounded-xl border bg-card">
      {shown === 0 ? <EmptyState icon={Users} title={invitations ? "No invitations found" : "No team members found"} description="Change the search, status filter or page to see other results." /> :
      <Table><TableHeader><TableRow><TableHead>{invitations ? "Email" : "Team member"}</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead>{invitations && <TableHead>Delivery / expiry</TableHead>}<TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
        {"memberships" in data && data.memberships.map(row => {
          const id = canonicalUuid(row.id);
          const permitted = id !== actor.id && row.role !== "OWNER" && (actor.role === "OWNER" || ["MANAGER", "AGENT"].includes(row.role));
          const editable = permitted && row.status === "ACTIVE";
          const draft = roleDraft[id] ?? row.role;
          return <TableRow key={id}><TableCell><p className="font-medium">{row.userProfile?.displayName || "Profile name unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">{row.email}</p></TableCell><TableCell>
            {editable ? <select value={draft} onChange={event => setRoleDraft(current => ({ ...current, [id]: event.target.value }))} disabled={Boolean(pending)} aria-label={"Role for " + row.email} className={selectStyle}>{roles.map(role => <option key={role}>{role}</option>)}</select> : row.role}
          </TableCell><TableCell><Badge variant="outline">{row.status}</Badge></TableCell><TableCell><div className="flex justify-end gap-2">
            {editable ? <><Button variant="outline" size="sm" disabled={Boolean(pending) || draft === row.role} onClick={() => action("/api/team/members/role", "PATCH", { membershipId: id, role: draft }, id)}>Save role</Button><Button variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => { if (window.confirm("Suspend " + row.email + "? They will lose company access.")) void action("/api/team/members/suspend", "POST", { membershipId: id, status: "SUSPENDED" }, id); }}>Suspend</Button></> : <span className="text-xs text-muted-foreground">{id === actor.id ? "Your membership" : row.role === "OWNER" ? "Owner protected" : "No available actions"}</span>}
          </div></TableCell></TableRow>;
        })}
        {"invitations" in data && data.invitations.map(row => {
          const id = canonicalUuid(row.membershipId);
          const permitted = row.status === "PENDING" && (actor.role === "OWNER" || row.role !== "ADMIN");
          const reinvitable = canReinviteRecipient(row) && (actor.role === "OWNER" || row.role !== "ADMIN");
          const expired = new Date(row.expiresAt).getTime() <= new Date(result.now).getTime();
          return <TableRow key={row.id}><TableCell className="font-medium">{row.email}</TableCell><TableCell>{row.role}</TableCell><TableCell><Badge variant="outline">{row.status === "PENDING" && expired ? "EXPIRED" : row.status}</Badge></TableCell><TableCell><p className="text-xs">{({ NOT_SENT: "Not sent", PREVIEW: "Development preview", ACCEPTED: "Provider accepted", FAILED: "Delivery not confirmed" })[row.deliveryStatus]}</p><p className="mt-1 text-xs text-muted-foreground">{date(row.expiresAt)} Dubai</p></TableCell><TableCell><div className="flex justify-end gap-2">{permitted ? <><Button variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => action("/api/team/invitations/reissue", "POST", { membershipId: id }, id)}>Reissue</Button><Button variant="outline" size="sm" disabled={Boolean(pending)} onClick={() => { if (window.confirm("Revoke this invitation? Its link will stop working.")) void action("/api/team/invitations/revoke", "POST", { membershipId: id }, id); }}>Revoke</Button></> : reinvitable ? <Button variant="outline" size="sm" disabled={Boolean(pending)} aria-label={"Re-invite " + row.email} onClick={() => action("/api/team/invitations/reinvite", "POST", { membershipId: id }, id)}>Re-invite</Button> : <span className="text-xs text-muted-foreground">No available actions</span>}</div></TableCell></TableRow>;
        })}
      </TableBody></Table>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground"><span>{total} result{total === 1 ? "" : "s"} · Page {filters.page} of {pages}</span><div className="flex gap-4">{filters.page > 1 && <Link href={pageHref(filters.page - 1)} className="rounded text-primary">Previous</Link>}{filters.page < pages && <Link href={pageHref(filters.page + 1)} className="rounded text-primary">Next</Link>}</div></div>
    </section>
    <p className="text-xs leading-5 text-muted-foreground">{invitations ? "Use Reissue for a pending invitation or Re-invite for a revoked invitation that was never accepted. Both create a fresh link after a one-minute cooldown. Old links stay invalid; accepted memberships cannot be renewed here." : "Owners are protected from role changes and suspension. Self-administration and administrator peer changes are unavailable."}</p>
  </div>;
}
