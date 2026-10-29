import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { InventoryAccessState } from "@/modules/inventory/components/inventory-access-state";
import { ListingList, type ListingListItem } from "@/modules/inventory/components/listing-views";
import { parseListingSort, parseListingView } from "@/modules/inventory/validation";
import { getListingListData } from "@/modules/inventory/server/views";

export const metadata: Metadata = {title: "Marketing listings"};
type SearchParams = Promise<Record<string,string|string[]|undefined>>;
const value=(input:string|string[]|undefined)=>typeof input==="string"?input:"";
async function Content({searchParams}:{searchParams:SearchParams}) {
  const query=await searchParams;
  const filters=Object.fromEntries(["search","listingStatus","purpose","marketType","emirate","community","propertyType","minimumPrice","maximumPrice"].map(key=>[key,value(query[key])]));
  const view=parseListingView(value(query.view));
  const sort=parseListingSort(value(query.sort));
  const page=Math.max(1,Math.min(401,Number.parseInt(value(query.page)||"1",10)||1));
  let data;
  try { data=await getListingListData({...filters,sort,page,view}); }
  catch(error) { if(error instanceof WorkspaceError)return <InventoryAccessState error={error} backHref="/properties"/>; throw error; }
  return <ListingList company={data.company} listings={data.propertyListings as ListingListItem[]} total={data.total} limit={data.limit} offset={data.offset} canManage={data.canManage} filters={filters} view={view} sort={sort} map={data.map} statusCounts={data.statusCounts} transitions={data.transitions} focus={value(query.focus)||null} />;
}
export default function ListingsPage({searchParams}:{searchParams:SearchParams}) {return <Suspense fallback={<main className="p-6"><PageSkeleton/></main>}><Content searchParams={searchParams}/></Suspense>;}
