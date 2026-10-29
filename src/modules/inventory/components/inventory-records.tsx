import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InventoryEmptyState } from "./inventory-access-state";
import { ArchiveDeveloperButton } from "./inventory-actions";
import { safeExternalUrl } from "./inventory-format";
import type { getDeveloperDetailData } from "../server/views";
import { LocationMapCard } from "@/modules/maps/components/location-map-card";

type DeveloperDetailData = Awaited<ReturnType<typeof getDeveloperDetailData>>;

function humanize(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Not provided";
}

function DateValue({value}: {value?: string | null}) {
  return <>{value ? new Date(value).toLocaleDateString("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai"}) : "Not provided"}</>;
}

export function DeveloperDetail({data}: {data: DeveloperDetailData}) {
  const {developer, headOffice, projects, canManage, company} = data;
  return <div className="mx-auto w-full max-w-[1400px] space-y-6 p-4 sm:p-6 lg:p-8">
    <Link href="/developers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Developers</Link>
    <PageHeader eyebrow={company.name} title={developer.name} description={developer.description || "Developer profile and associated project portfolio."}>
      {canManage && <><Link href={`/developers/${developer.id}/edit`} className={buttonVariants({variant: "outline"})}><Pencil aria-hidden="true" />Edit</Link><ArchiveDeveloperButton id={developer.id} organizationId={company.id} hasProjects={projects.total > 0} /></>}
    </PageHeader>
    {projects.total > 0 && <p className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">This developer has {projects.total} active {projects.total === 1 ? "project" : "projects"}. Archive or move those projects before archiving the developer.</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <Card><CardHeader><CardTitle>Company information</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        <Info label="Developer name" value={developer.name} /><Info label="Slug" value={developer.slug} /><Info label="Status" value={humanize(developer.status)} /><Info label="Country" value={developer.country} /><Info label="Logo reference" value={safeExternalUrl(developer.logoReference) ? "Open saved logo URL" : "Not provided"} href={safeExternalUrl(developer.logoReference)} external /><Info label="Company email" value={developer.email} href={developer.email ? `mailto:${developer.email}` : undefined} /><Info label="Contact phone" value={developer.phone} href={developer.phone ? `tel:${developer.phone}` : undefined} /><Info label="Website" value={developer.website} href={safeExternalUrl(developer.website)} external /><Info label="Head office" value={developer.headOfficeAddress} /><Info label="Created" value={<DateValue value={developer.createdAt} />} /><Info label="Last updated" value={<DateValue value={developer.updatedAt} />} />
      </CardContent></Card>
      <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Associated projects</CardTitle><Badge variant="outline">{projects.total}</Badge></div></CardHeader><CardContent>
        {projects.projects.length ? <ul className="divide-y">{projects.projects.map(project => <li key={project.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.projectName}</Link><p className="mt-1 text-xs text-muted-foreground">{project.projectCode} · {humanize(project.projectStatus)}</p></div><Link href={`/projects/${project.id}`} aria-label={`Open ${project.projectName}`} className="rounded-md p-1 text-muted-foreground hover:text-primary"><ArrowRight className="size-4" aria-hidden="true" /></Link></li>)}</ul> : <InventoryEmptyState title="No active projects" description="Projects associated with this developer will appear here." action={canManage ? <Link href={`/projects/new?developerId=${developer.id}`} className={buttonVariants({variant: "outline"})}><Plus aria-hidden="true" />Create project</Link> : undefined} />}
      </CardContent></Card>
    </div>
    <LocationMapCard title="Head office" showMode={false} searchRegion={developer.country === "AE" ? undefined : null} recordLabel={`${developer.name} head office`} location={headOffice}
      summary={developer.headOfficeAddress || (developer.country === "AE" ? "United Arab Emirates" : developer.country)} />
  </div>;
}

function Info({label, value, href, external}: {label: string; value: React.ReactNode; href?: string; external?: boolean}) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p>{href ? <a className="mt-1 inline-flex max-w-full items-center gap-1 break-all font-medium text-primary hover:underline" href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{value || "Not provided"}{external && <ExternalLink className="size-3 shrink-0" aria-hidden="true" />}</a> : <p className="mt-1 break-words font-medium">{value || "Not provided"}</p>}</div>;
}
