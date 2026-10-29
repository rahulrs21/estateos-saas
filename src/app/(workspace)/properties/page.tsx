import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { PropertyList } from "@/modules/inventory/components/property-management";
import { getPropertyListData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Property inventory"};
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const value = (input: string | string[] | undefined) => typeof input === "string" ? input : "";

async function Content({searchParams}: {searchParams: SearchParams}) {
  const query = await searchParams;
  const filters = Object.fromEntries(["search", "projectId", "developerId", "community", "propertyType", "bedrooms", "minimumPrice", "maximumPrice", "inventoryStatus", "assignedMembershipId", "buildingId", "marketType", "emirate"].map(key => [key, value(query[key])]));
  const page = Math.max(1, Math.min(401, Number.parseInt(value(query.page) || "1", 10) || 1));
  const requestedView = value(query.view);
  const view = requestedView === "cards" || requestedView === "map" ? requestedView : "table";
  let data: Awaited<ReturnType<typeof getPropertyListData>> | null = null; let failure: WorkspaceError | null = null;
  try { data = await getPropertyListData({...filters, page, view}); } catch (error) { if (error instanceof WorkspaceError) failure = error; else throw error; }
  if (failure) return <InventoryAccessState error={failure} backHref="/workspace/dashboard" />;
  if (!data) throw new Error("Property inventory was not loaded.");
  return <PropertyList data={data} filters={filters} view={view} />;
}

export default function PropertiesPage({searchParams}: {searchParams: SearchParams}) { return <Suspense fallback={<main className="p-6"><PageSkeleton /></main>}><Content searchParams={searchParams} /></Suspense>; }
