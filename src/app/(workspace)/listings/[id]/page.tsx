import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ListingDetail, type ListingDetailRecord } from "@/modules/inventory/components/listing-views";
import { getListingDetailData } from "@/modules/inventory/server/views";

export const metadata:Metadata={title:"Marketing listing"};
type Params=Promise<{id:string}>;
async function Content({params}:{params:Params}){let data;try{data=await getListingDetailData((await params).id);}catch(error){if(error instanceof WorkspaceError)return <InventoryAccessState error={error} backHref="/listings"/>;throw error;}return <ListingDetail company={data.company} listing={data.listing as ListingDetailRecord} canManage={data.canManage} canEdit={data.canManage||data.company.role==="AGENT"} location={data.location} history={data.history} transitions={data.transitions}/>;}
export default function ListingDetailPage({params}:{params:Params}){return <Suspense fallback={<main className="p-6"><PageSkeleton/></main>}><Content params={params}/></Suspense>;}
