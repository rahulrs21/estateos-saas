"use client";

import { useState } from "react";
import { Database, Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { mapLookup } from "@/modules/maps/client/api";
import { MapCanvas } from "@/modules/maps/components/map-canvas";
import { isWithinUae, roundCoordinate } from "@/modules/maps/geo";
import { CUSTOM_LOCATION_MODES, type CustomLocation } from "../../registry";
import { Segmented, inputClass } from "./controls";
import { useEditorServices } from "./editor-context";

/*
 * Location for a location section: the linked record's (with that record's
 * map privacy) or a pin set on the page. "Approximate area" pins are
 * generalized on the server before publication, so the exact point never
 * reaches a public page. The map loads only when staff open it.
 */

const DUBAI = {latitude: 25.2048, longitude: 55.2708};
const MODE_LABELS = {EXACT: "Exact pin", APPROXIMATE: "Approximate area"} as const;

export function LocationControl({value, onChange}: {value: CustomLocation | null; onChange: (value: CustomLocation | null) => void}) {
  const {payload, organizationId} = useEditorServices();
  const recorded = payload.linked.location;
  const [mapOpen, setMapOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const custom = value;
  const set = (patch: Partial<CustomLocation>) => onChange({label: "", address: "", ...DUBAI, mode: "APPROXIMATE", ...custom, ...patch});
  const find = async () => {
    const query = (custom?.address || custom?.label || "").trim();
    if (!query) { toast.error("Type an address or place name first."); return; }
    setSearching(true);
    try {
      const {places} = await mapLookup.geocode(organizationId, query);
      const place = places.find(item => isWithinUae(item.latitude, item.longitude));
      if (!place) { toast.error("No place in the UAE matched. Place the pin on the map instead."); return; }
      set({latitude: roundCoordinate(place.latitude), longitude: roundCoordinate(place.longitude), address: custom?.address || (place.formattedAddress ?? "").slice(0, 300)});
      setMapOpen(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Address search is unavailable. Place the pin on the map."); } finally { setSearching(false); }
  };
  return <div className="space-y-3 rounded-md border border-white/10 bg-white/[0.03] p-3">
    <p className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-100"><MapPin className="size-4 text-sky-300" aria-hidden="true" />Location</p>
    <Segmented value={custom ? "CUSTOM" : "RECORD"} options={["RECORD", "CUSTOM"] as const} labels={{RECORD: "Linked record", CUSTOM: "Set on this page"}}
      onChange={choice => choice === "RECORD" ? onChange(null) : set({})} />
    {!custom
      ? recorded
        ? <p className="flex items-start gap-1.5 text-[11px] text-sky-200"><Database className="mt-0.5 size-3 shrink-0" aria-hidden="true" />From CRM: {recorded.text} ({recorded.display.precision === "EXACT" ? "exact pin" : recorded.display.precision === "APPROXIMATE" ? "approximate area" : "no map"}, set on the record)</p>
        : <p className="text-[11px] text-amber-200">The linked records have no location. Choose “Set on this page” to add one.</p>
      : <div className="space-y-2.5">
        <input value={custom.label} maxLength={120} onChange={event => set({label: event.target.value})} placeholder="Place name, for example Dubai Marina" aria-label="Place name" className={`${inputClass} text-xs`} />
        <div className="flex gap-1.5">
          <input value={custom.address} maxLength={300} onChange={event => set({address: event.target.value})} placeholder="Address or area shown on the page" aria-label="Address" className={`${inputClass} text-xs`} />
          <button type="button" onClick={() => void find()} disabled={searching} title="Find on the map" aria-label="Find the address on the map" className="grid size-9 shrink-0 place-items-center rounded-md border border-white/15 text-zinc-200 hover:border-sky-400 disabled:opacity-50">
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Search className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <Segmented label="Show visitors" value={custom.mode} options={CUSTOM_LOCATION_MODES} labels={MODE_LABELS} onChange={mode => set({mode})} />
        <p className="text-[11px] leading-4 text-zinc-500">{custom.mode === "EXACT" ? "Visitors see the exact pin." : "Visitors see a generalized area (about 1 km); the exact pin is never published."}</p>
        {mapOpen
          ? <MapCanvas label="Place the location pin" className="h-56 overflow-hidden rounded-md" fit="initial"
            markers={[{id: "pin", latitude: custom.latitude, longitude: custom.longitude, title: custom.label || "Location", precision: "EXACT"}]}
            onPositionChange={(latitude, longitude) => { if (isWithinUae(latitude, longitude)) set({latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude)}); else toast.error("Place the pin inside the UAE."); }}
            unavailable="The map is unavailable. Enter the coordinates below." />
          : <button type="button" onClick={() => setMapOpen(true)} className="flex h-24 w-full items-center justify-center gap-2 rounded-md border border-dashed border-white/20 text-xs text-zinc-300 hover:border-sky-400 hover:text-white">
            <MapPin className="size-4" aria-hidden="true" />Open the map to place the pin</button>}
        <div className="grid grid-cols-2 gap-1.5">
          <label className="space-y-1 text-[10px] uppercase tracking-wider text-zinc-500">Latitude<input type="number" step="0.000001" value={custom.latitude} aria-label="Latitude"
            onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next)) set({latitude: roundCoordinate(next)}); }} className={`${inputClass} h-8 text-xs normal-case tracking-normal`} /></label>
          <label className="space-y-1 text-[10px] uppercase tracking-wider text-zinc-500">Longitude<input type="number" step="0.000001" value={custom.longitude} aria-label="Longitude"
            onChange={event => { const next = Number(event.target.value); if (Number.isFinite(next)) set({longitude: roundCoordinate(next)}); }} className={`${inputClass} h-8 text-xs normal-case tracking-normal`} /></label>
        </div>
        {!isWithinUae(custom.latitude, custom.longitude) && <p className="text-[11px] text-amber-300">The pin must be inside the UAE before the page can be saved.</p>}
      </div>}
  </div>;
}
