import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ListingForm, type ListingRecord } from "@/modules/inventory/components/listing-management";
import { getListingFormData } from "@/modules/inventory/server/views";

export const metadata:Metadata={title:"Edit marketing listing"};
type Params=Promise<{id:string}>;
async function Content({params}:{params:Params}){const {id}=await params;let data;try{data=await getListingFormData(id);}catch(error){if(error instanceof WorkspaceError)return <InventoryAccessState error={error} backHref="/listings"/>;throw error;}if(!data.canManage&&data.company.role!=="AGENT")return <InventoryAccessState error={new WorkspaceError("FORBIDDEN",403,"Your role cannot edit marketing listings.")} backHref={`/listings/${id}`}/>;return <main className="mx-auto w-full max-w-[1200px] space-y-6 p-4 sm:p-6 lg:p-8"><PageHeader eyebrow={data.company.name} title={`Edit ${data.listing?.listingReference??"listing"}`} description="Update the listing while preserving its separate property record."/><ListingForm {...data} listing={data.listing as ListingRecord}/></main>;}
export default function EditListingPage({params}:{params:Params}){return <Suspense fallback={<main className="p-6"><PageSkeleton/></main>}><Content params={params}/></Suspense>;}
