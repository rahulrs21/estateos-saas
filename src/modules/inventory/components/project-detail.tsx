import Link from "next/link";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { InventoryEmptyState } from "./inventory-access-state";
import { ProjectStructureManager } from "./project-structure-manager";
import { safeExternalUrl } from "./inventory-format";
import { PaymentPlanManager } from "./payment-plan-manager";
import { FloorPlanManager } from "./floor-plan-manager";
import { MediaGallery } from "./property-management";
import { LocationMapCard } from "@/modules/maps/components/location-map-card";
import { describeLocation } from "@/modules/maps/geo";
import type { getProjectDetailData } from "../server/views";
import { AiContentLink } from "@/modules/ai/content/components/ai-content-link";

type DetailData = Awaited<ReturnType<typeof getProjectDetailData>>;
const tabs = [
  ["overview", "Overview"], ["structure", "Buildings & Phases"], ["units", "Units"],
  ["floor-plans", "Floor Plans"], ["payment-plans", "Payment Plans"], ["documents", "Documents"], ["activity", "Activity"],
] as const;
export type ProjectDetailTab = (typeof tabs)[number][0];

function humanize(value: string | null | undefined) { return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) : "Not set"; }
function dateLabel(value?: string | null) { return value ? new Date(value).toLocaleDateString("en-AE", {day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai"}) : "Not set"; }
function priceLabel(value?: string | null, currency = "AED") {
  if (!value) return "Not provided";
  try { return new Intl.NumberFormat("en-AE", {style: "currency", currency, maximumFractionDigits: 2}).format(Number(BigInt(value)) / 100); }
  catch { return `${value} ${currency} minor units`; }
}

export function ProjectDetail({data, selectedTab}: {data: DetailData; selectedTab: ProjectDetailTab}) {
  const {project, company} = data;
  const counts: Record<ProjectDetailTab, number | null> = {
    overview: null, structure: data.phases.total + data.buildings.total,
    units: data.units.total, "floor-plans": data.floorPlans.total,
    "payment-plans": data.paymentPlans.total, documents: null, activity: data.audit.total,
  };
  return <div className="mx-auto w-full max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" />Projects</Link>
    <PageHeader eyebrow={`${company.name} · ${project.developer.name}`} title={project.projectName} description={project.description || `${project.projectCode} · ${humanize(project.projectType)} project`}>
      <AiContentLink label="Generate Project Marketing Content" type="PROJECT_MARKETING" purpose="PROJECT_OVERVIEW" record={{kind: "projectId", id: project.id}} />
      {data.canManage && <Link href={`/projects/${project.id}/edit`} className={buttonVariants({variant: "outline"})}><Pencil aria-hidden="true" />Edit project</Link>}
    </PageHeader>
    <div className="flex flex-wrap gap-2"><Badge variant={project.projectStatus === "ACTIVE" ? "secondary" : "outline"}>{humanize(project.projectStatus)}</Badge><Badge variant="outline">{humanize(project.constructionStatus)}</Badge><Badge variant="outline">{humanize(project.ownershipType)}</Badge></div>
    <div role="tablist" aria-label="Project details" className="flex gap-1 overflow-x-auto border-b pb-px">
      {tabs.map(([value, label]) => <Link key={value} role="tab" aria-selected={selectedTab === value} aria-current={selectedTab === value ? "page" : undefined} href={`/projects/${project.id}?tab=${value}`} className={`shrink-0 rounded-t-lg px-3 py-2.5 text-sm transition-colors ${selectedTab === value ? "border-b-2 border-primary bg-primary/5 font-medium text-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"}`}>
        {label}{counts[value] !== null && <span className="ml-1.5 text-xs text-muted-foreground">{counts[value]}</span>}
      </Link>)}
    </div>
    <section role="tabpanel" aria-label={tabs.find(([value]) => value === selectedTab)?.[1]}>
      {selectedTab === "overview" && <Overview data={data} />}
      {selectedTab === "structure" && <ProjectStructureManager company={company} projectId={project.id} phases={data.phases.projectPhases} buildings={data.buildings.buildings} canManage={data.canManage} />}
      {selectedTab === "units" && <Units data={data} />}
      {selectedTab === "floor-plans" && <FloorPlans data={data} />}
      {selectedTab === "payment-plans" && <PaymentPlans data={data} />}
      {selectedTab === "documents" && <Documents data={data} />}
      {selectedTab === "activity" && <Activity data={data} />}
    </section>
  </div>;
}

function Overview({data}: {data: DetailData}) {
  const {project} = data;
  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
    <div className="space-y-5">
      <Card><CardHeader><CardTitle>Project overview</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        <Detail label="Project reference" value={project.projectCode} /><Detail label="Developer" value={<Link className="text-primary hover:underline" href={`/developers/${project.developer.id}`}>{project.developer.name}</Link>} /><Detail label="Project type" value={humanize(project.projectType)} /><Detail label="Ownership" value={humanize(project.ownershipType)} /><Detail label="Project status" value={humanize(project.projectStatus)} /><Detail label="Construction status" value={humanize(project.constructionStatus)} /><Detail label="Launch date" value={dateLabel(project.launchDate)} /><Detail label="Expected handover" value={dateLabel(project.expectedHandoverDate)} /><Detail label="Actual handover" value={dateLabel(project.actualHandoverDate)} /><Detail label="Starting price" value={priceLabel(project.startingPriceMinor, project.currency)} /><Detail label="Declared planned units" value={project.totalUnits == null ? "Not provided" : String(project.totalUnits)} /><Detail label="Active recorded units" value={String(data.units.total)} />
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Location</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
        <Detail label="Country" value={project.country} /><Detail label="Emirate" value={humanize(project.emirate)} /><Detail label="Community" value={project.community || "Not provided"} /><Detail label="Area" value={project.area || "Not provided"} /><Detail label="City" value={project.city || "Not provided"} /><Detail label="Address" value={project.address || "Not provided"} />
      </CardContent></Card>
      <LocationMapCard title="Project location" recordLabel={project.projectName} location={data.location} summary={describeLocation(project)} secondary={data.buildingMarkers} secondaryLabel="Buildings" />
      <Card><CardHeader><CardTitle>Project highlights</CardTitle></CardHeader><CardContent>{project.marketingDescription ? <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{project.marketingDescription}</p> : <p className="text-sm text-muted-foreground">No project highlights have been added.</p>}</CardContent></Card>
    </div>
    <div className="space-y-5">
      <Card><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle>Key amenities</CardTitle><Badge variant="outline">{project.projectAmenities_on_project.length}</Badge></div></CardHeader><CardContent>{project.projectAmenities_on_project.length ? <div className="flex flex-wrap gap-2">{project.projectAmenities_on_project.map(item => <Badge key={item.id} variant="secondary">{item.amenity.name}</Badge>)}</div> : <InventoryEmptyState title="No amenities recorded" description="Select company amenities in the project editor to show them here." />}</CardContent></Card>
      <Card><CardHeader><CardTitle>Regulatory reference</CardTitle></CardHeader><CardContent className="space-y-3"><Detail label="Permit number" value={project.permitNumber || "Not provided"} /><Detail label="Permit expiry" value={dateLabel(project.permitExpiryDate)} />{safeExternalUrl(project.permitReferenceUrl) ? <a href={safeExternalUrl(project.permitReferenceUrl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open permit reference <ExternalLink className="size-3" aria-hidden="true" /></a> : <p className="text-sm text-muted-foreground">No safe permit reference URL stored.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Inventory summary</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4"><Metric label="Phases" value={data.phases.total} /><Metric label="Buildings" value={data.buildings.total} /><Metric label="Recorded units" value={data.units.total} /><Metric label="Floor plans" value={data.floorPlans.total} /><Metric label="Payment plans" value={data.paymentPlans.total} /></CardContent></Card>
    </div>
  </div>;
}

function Units({data}: {data: DetailData}) {
  return <Card className="overflow-hidden py-0"><div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4"><div><h2 className="font-semibold">Units and properties</h2><p className="mt-1 text-xs text-muted-foreground">{data.units.total} active records in this project.</p></div><Badge variant="outline">{data.units.total} recorded</Badge></div>
    {data.units.properties.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Building</th><th className="px-4 py-3">Bedrooms</th><th className="px-4 py-3">Area</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y">{data.units.properties.map(unit => <tr key={unit.id}><td className="px-4 py-3 font-medium">{unit.propertyReference}</td><td className="px-4 py-3">{humanize(unit.propertyType)}</td><td className="px-4 py-3">{unit.unitNumber || "Not set"}</td><td className="px-4 py-3">{unit.building?.name || "Not assigned"}</td><td className="px-4 py-3">{unit.bedrooms == null ? "Not set" : unit.bedrooms}</td><td className="px-4 py-3">{unit.builtUpArea == null ? "Not recorded" : `${unit.builtUpArea.toLocaleString()} ${unit.areaUnit}`}</td><td className="px-4 py-3"><Badge variant="outline">{humanize(unit.inventoryStatus)}</Badge></td></tr>)}</tbody></table></div> : <InventoryEmptyState title="No units recorded" description="Units linked to this project will appear here when your team adds them to the inventory." />}
  </Card>;
}

function FloorPlans({data}: {data: DetailData}) {
  return <div className="space-y-5"><FloorPlanManager companyId={data.company.id} projectId={data.project.id} units={data.units.properties} buildings={data.buildings.buildings} canManage={data.canManage}/>{data.floorPlans.floorPlans.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{data.floorPlans.floorPlans.map(plan => <Card key={plan.id}><CardHeader><CardTitle>{plan.name}</CardTitle><p className="text-xs text-muted-foreground">{humanize(plan.propertyType)} · {plan.bedrooms == null ? "Bedrooms not set" : `${plan.bedrooms} bedrooms`}</p></CardHeader><CardContent className="space-y-3 text-sm"><p>{plan.builtUpArea == null ? "Area not provided" : `${plan.builtUpArea.toLocaleString()} ${plan.areaUnit}`}</p>{plan.property && <p className="text-xs text-muted-foreground">Unit {plan.property.propertyReference}</p>}{data.canManage && plan.inventoryMedias_on_floorPlan.length ? <MediaGallery company={data.company} media={plan.inventoryMedias_on_floorPlan} canManage /> : <p className="text-xs text-muted-foreground">{data.canManage ? "No private floor-plan file uploaded." : "Private floor-plan files are available to company administrators."}</p>}{safeExternalUrl(plan.mediaReference) ? <a href={safeExternalUrl(plan.mediaReference)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Open external reference <ExternalLink className="size-3" aria-hidden="true" /></a> : null}</CardContent></Card>)}</div> : <InventoryEmptyState title="No floor plans recorded" description="Floor plans added to this project will appear here. Uploads remain private to company members." />}</div>;
}

function PaymentPlans({data}: {data: DetailData}) {
  return <PaymentPlanManager company={data.company} projectId={data.project.id} plans={data.paymentPlans.paymentPlans} units={data.units.properties} canManage={data.canManage} />;
}

function Documents({data}: {data: DetailData}) {
  const files = data.floorPlans.floorPlans.filter(plan => safeExternalUrl(plan.mediaReference));
  return <div className="space-y-5">
    {safeExternalUrl(data.project.brochureReference) && <Card><CardHeader><CardTitle>Project brochure</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">Brochure reference</p><p className="mt-1 text-xs text-muted-foreground">URL stored on the project record.</p></div><a href={safeExternalUrl(data.project.brochureReference)} target="_blank" rel="noreferrer" className={buttonVariants({variant: "outline"})}>Open brochure <ExternalLink aria-hidden="true" /></a></CardContent></Card>}
    {safeExternalUrl(data.project.permitReferenceUrl) && <Card><CardHeader><CardTitle>Permit reference</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium">{data.project.permitNumber || "Permit link"}</p><p className="mt-1 text-xs text-muted-foreground">Reference URL stored on the project profile.</p></div><a href={safeExternalUrl(data.project.permitReferenceUrl)} target="_blank" rel="noreferrer" className={buttonVariants({variant: "outline"})}>Open reference <ExternalLink aria-hidden="true" /></a></CardContent></Card>}
    {files.length ? <Card><CardHeader><CardTitle>Floor plan media references</CardTitle></CardHeader><CardContent><ul className="divide-y">{files.map(plan => <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><span className="text-sm font-medium">{plan.name}</span><a href={safeExternalUrl(plan.mediaReference)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">Open media <ExternalLink className="size-3" aria-hidden="true" /></a></li>)}</ul></CardContent></Card> : null}
    {!safeExternalUrl(data.project.brochureReference) && !safeExternalUrl(data.project.permitReferenceUrl) && files.length === 0 && <InventoryEmptyState title="No document references stored" description="The project can store a brochure URL and floor-plan or permit references, but has no general document library or file upload. No files have been fabricated or uploaded." />}
  </div>;
}

function Activity({data}: {data: DetailData}) {
  return data.audit.auditLogs.length ? <Card><CardHeader><CardTitle>Project activity</CardTitle><p className="text-xs text-muted-foreground">Sensitive project changes recorded by the server.</p></CardHeader><CardContent><ol className="space-y-0">{data.audit.auditLogs.map(event => <li key={event.id} className="flex gap-3 border-l pl-4 pb-5 last:pb-0"><span className="-ml-[1.35rem] mt-0.5 size-2.5 rounded-full border-2 border-primary bg-background" aria-hidden="true" /><div><p className="text-sm font-medium">{humanize(event.action)}</p><p className="mt-1 text-xs text-muted-foreground"><DateTime value={event.createdAt} /></p></div></li>)}</ol></CardContent></Card> : <InventoryEmptyState title="No project activity yet" description="Server-recorded project actions will appear here." />;
}

function DateTime({value}: {value: string}) { return <>{new Date(value).toLocaleString("en-AE", {dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dubai"})} Dubai time</>; }
function Detail({label, value}: {label: string; value: React.ReactNode}) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-medium">{value}</p></div>; }
function Metric({label, value}: {label: string; value: string | number}) { return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold tabular-nums">{value}</p></div>; }
