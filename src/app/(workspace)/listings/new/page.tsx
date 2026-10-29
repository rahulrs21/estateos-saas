import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ListingForm } from "@/modules/inventory/components/listing-management";
import { getListingFormData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title:"Create marketing listing"};
type SearchParams=Promise<Record<string,string|string[]|undefined>>;
async function Content({searchParams}:{searchParams:SearchParams}) {
  const query=await searchParams; const propertyId=typeof query.propertyId==="string"?query.propertyId:undefined;
  let data;
  try { data=await getListingFormData(); }
  catch(error){if(error instanceof WorkspaceError)return <InventoryAccessState error={error} backHref="/listings"/>;throw error;}
  if(!data.canManage&&data.company.role!=="AGENT")return <InventoryAccessState error={new WorkspaceError("FORBIDDEN",403,"Your role cannot create marketing listings.")} backHref="/listings"/>;
  return <main className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8"><PageHeader eyebrow={data.company.name} title="Create marketing listing" description="Prepare a separate listing record from company property inventory."/><ListingForm {...data} listing={null} defaultPropertyId={propertyId}/></main>;
}
export default function NewListingPage({searchParams}:{searchParams:SearchParams}){return <Suspense fallback={<main className="p-6"><PageSkeleton/></main>}><Content searchParams={searchParams}/></Suspense>;}
