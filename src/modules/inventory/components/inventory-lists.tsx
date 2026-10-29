import Link from "next/link";
import { ArrowRight, Building2, FolderKanban, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryEmptyState, InventoryPagination } from "./inventory-access-state";
import type { getDeveloperListData, getProjectListData } from "../server/views";

type DeveloperListData = Awaited<ReturnType<typeof getDeveloperListData>>;
type ProjectListData = Awaited<ReturnType<typeof getProjectListData>>;

function humanize(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Not set";
}

function dateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-AE", {day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai"});
}

export function DeveloperList({data, search}: {data: DeveloperListData; search: string}) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow={data.company.name} title="Developers" description="Manage developer relationships and their company information.">
      {data.canManage && <Link href="/developers/new" className={buttonVariants({size: "lg"})}><Plus aria-hidden="true" />Add developer</Link>}
    </PageHeader>
    <Card><CardContent className="p-4 sm:p-5">
      <form action="/developers" method="get" className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="developer-search">Search developers</label>
        <div className="relative min-w-0 flex-1"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="developer-search" name="search" defaultValue={search} placeholder="Search by developer name" className="h-10 pl-9" /></div>
        <Button type="submit" variant="outline" className="h-10"><Search aria-hidden="true" />Search</Button>
      </form>
    </CardContent></Card>
    {data.developers.length === 0 ? <InventoryEmptyState icon={Building2} title={search ? "No developers match this search" : "No developers yet"} description={search ? "Try a different name or clear the search." : "Add the developers your agency works with. Developer records stay within this company workspace."} action={data.canManage && !search ? <Link href="/developers/new" className={buttonVariants()}><Plus aria-hidden="true" />Add developer</Link> : undefined} /> :
      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Developer</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Projects</th><th className="px-4 py-3 font-medium">Updated</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-border">
            {data.developers.map(developer => <tr key={developer.id} className="hover:bg-muted/20">
              <td className="px-4 py-3"><Link href={`/developers/${developer.id}`} className="font-medium hover:text-primary">{developer.name}</Link><p className="mt-0.5 text-xs text-muted-foreground">{developer.slug}</p></td>
              <td className="px-4 py-3 text-muted-foreground">{developer.headOfficeAddress || developer.country}</td>
              <td className="px-4 py-3"><Badge variant={developer.status === "ACTIVE" ? "secondary" : "outline"}>{humanize(developer.status)}</Badge></td>
              <td className="px-4 py-3 text-muted-foreground">{developer.projects_on_developer[0]?._count ?? 0}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{dateLabel(developer.updatedAt)}</td>
              <td className="px-4 py-3 text-right"><Link href={`/developers/${developer.id}`} aria-label={`View ${developer.name}`} className={buttonVariants({variant: "outline", size: "sm"})}>View <ArrowRight aria-hidden="true" /></Link></td>
            </tr>)}
          </tbody>
        </table></div>
        <InventoryPagination basePath="/developers" page={Math.max(1, data.offset / data.limit + 1)} total={data.total} limit={data.limit} query={query.toString()} />
      </Card>}
  </div>;
}

export function ProjectList({data, search, status, emirate, developerId}: {data: ProjectListData; search: string; status: string; emirate: string; developerId: string}) {
  const query = new URLSearchParams();
  if (search) query.set("search", search);
  if (status) query.set("status", status);
  if (emirate) query.set("emirate", emirate);
  if (developerId) query.set("developerId", developerId);
  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <PageHeader eyebrow={data.company.name} title="Projects" description="Explore your company’s real estate projects, construction progress, and recorded inventory.">
      {data.canManage && <Link href="/projects/new" className={buttonVariants({size: "lg"})}><Plus aria-hidden="true" />Add project</Link>}
    </PageHeader>
    <Card><CardContent className="p-4 sm:p-5">
      <form action="/projects" method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_12rem_12rem_14rem_auto]">
        <label className="sr-only" htmlFor="project-search">Search projects</label>
        <div className="relative"><Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="project-search" name="search" defaultValue={search} placeholder="Project name" className="h-10 pl-9" /></div>
        <label className="sr-only" htmlFor="project-status">Project status</label><select id="project-status" name="status" defaultValue={status} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All statuses</option>{["DRAFT", "ACTIVE", "INACTIVE", "COMPLETED"].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
        <label className="sr-only" htmlFor="project-emirate">Emirate</label><select id="project-emirate" name="emirate" defaultValue={emirate} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All emirates</option>{["ABU_DHABI", "DUBAI", "SHARJAH", "AJMAN", "UMM_AL_QUWAIN", "RAS_AL_KHAIMAH", "FUJAIRAH"].map(value => <option key={value} value={value}>{humanize(value)}</option>)}</select>
        <label className="sr-only" htmlFor="project-developer">Developer</label><select id="project-developer" name="developerId" defaultValue={developerId} className="h-10 rounded-lg border border-input bg-background px-3 text-sm"><option value="">All developers</option>{data.developers.map(developer => <option key={developer.id} value={developer.id}>{developer.name}</option>)}</select>
        <Button type="submit" variant="outline" className="h-10"><Search aria-hidden="true" />Filter</Button>
      </form>
    </CardContent></Card>
    {data.projects.length === 0 ? <InventoryEmptyState icon={FolderKanban} title={search || status || emirate || developerId ? "No projects match these filters" : "No projects yet"} description={search || status || emirate || developerId ? "Adjust the filters or clear them to see more projects." : "Create a project to record its location, timeline, marketing details, phases, buildings, and inventory."} action={data.canManage && !search && !status && !emirate && !developerId ? <Link href="/projects/new" className={buttonVariants()}><Plus aria-hidden="true" />Add project</Link> : undefined} /> :
      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Project</th><th className="px-4 py-3 font-medium">Developer</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Available units</th><th className="px-4 py-3 font-medium">Handover</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody className="divide-y divide-border">{data.projects.map(project => <tr key={project.id} className="hover:bg-muted/20">
            <td className="px-4 py-3"><Link href={`/projects/${project.id}`} className="font-medium hover:text-primary">{project.projectName}</Link><p className="mt-0.5 text-xs text-muted-foreground">{project.projectCode} · {humanize(project.projectType)}</p></td>
            <td className="px-4 py-3 text-muted-foreground">{project.developer.name}</td>
            <td className="px-4 py-3 text-muted-foreground">{[project.community, project.area, humanize(project.emirate)].filter(value => value && value !== "Not set").join(", ") || "Not set"}</td>
            <td className="px-4 py-3"><Badge variant={project.projectStatus === "ACTIVE" ? "secondary" : "outline"}>{humanize(project.projectStatus)}</Badge><p className="mt-1 text-[11px] text-muted-foreground">{humanize(project.constructionStatus)}</p></td>
            <td className="px-4 py-3 text-muted-foreground">{project.properties_on_project[0]?._count ?? 0}</td>
            <td className="px-4 py-3 text-xs text-muted-foreground">{project.expectedHandoverDate ? dateLabel(project.expectedHandoverDate) : "Not set"}</td>
            <td className="px-4 py-3 text-right"><Link href={`/projects/${project.id}`} aria-label={`View ${project.projectName}`} className={buttonVariants({variant: "outline", size: "sm"})}>View <ArrowRight aria-hidden="true" /></Link></td>
          </tr>)}</tbody>
        </table></div>
        <InventoryPagination basePath="/projects" page={Math.max(1, data.offset / data.limit + 1)} total={data.total} limit={data.limit} query={query.toString()} />
      </Card>}
  </div>;
}
