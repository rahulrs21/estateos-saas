import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { listInventoryMapPins } from "@/modules/inventory/server/service";
import { humanizeInventoryValue } from "@/modules/inventory/components/inventory-format";
import { describeLocation } from "@/modules/maps/geo";
import { WorkspaceError } from "@/modules/organizations/server/errors";
import { DashboardCard, SectionError } from "./dashboard-card";
import { DashboardMapCanvas, type DashboardMapPin } from "./dashboard-map-canvas";

const integer = new Intl.NumberFormat("en-AE");

/** The "properties" variant of the pin page (the function also serves listings). */
type PropertyPinPage = Extract<Awaited<ReturnType<typeof listInventoryMapPins>>, {pins: Array<{propertyReference: string}>}>;

/**
 * Where the member's properties are. Pins come from the same scoped, rate
 * limited operation as the property map view: approximate locations are
 * coarsened on the server and hidden ones are never returned. Only the fields
 * the map needs are sent to the browser.
 */
export async function DashboardMap() {
  const action = <Link href="/properties?view=map" className="inline-flex items-center gap-1 rounded font-medium text-primary hover:underline">Open map<ArrowRight className="size-3.5" aria-hidden="true" /></Link>;
  let page: PropertyPinPage;
  try {
    page = await listInventoryMapPins("properties", {}) as PropertyPinPage;
  } catch (error) {
    if (!(error instanceof WorkspaceError)) throw error;
    return <DashboardCard title="Property locations" action={action}><SectionError message={error.message} /></DashboardCard>;
  }
  const pins: DashboardMapPin[] = page.pins.flatMap(pin => pin.location.latitude == null || pin.location.longitude == null || pin.location.precision === "NONE" ? [] : [{
    id: pin.id, reference: pin.propertyReference, status: humanizeInventoryValue(pin.inventoryStatus),
    place: describeLocation(pin) || pin.project?.projectName || "Location on map",
    latitude: pin.location.latitude, longitude: pin.location.longitude, precision: pin.location.precision, radiusMeters: pin.location.radiusMeters,
  }]);
  const description = page.total === 0
    ? "No properties in your inventory scope yet."
    : `${integer.format(page.mappedAll)} of ${integer.format(page.total)} properties have a map location${page.mappedAll > pins.length ? `; showing the ${integer.format(pins.length)} most recently updated` : ""}.`;
  return <DashboardCard title="Property locations" description={description} action={action} contentClassName="flex flex-col gap-3">
    <DashboardMapCanvas pins={pins} />
  </DashboardCard>;
}
