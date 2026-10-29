"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Crosshair, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  describeLocation, emirateLabels, emirates, isWithinUae, mapDisplayModeLabels, mapDisplayModes, roundCoordinate,
  type MapDisplayMode,
} from "../geo";
import type { NormalizedPlace, PlaceSuggestion } from "../google-client";
import { mapLookup } from "../client/api";
import { MapCanvas } from "./map-canvas";

export type LocationFieldValues = {
  emirate?: string | null; city?: string | null; community?: string | null; area?: string | null; address?: string | null;
  latitude?: number | null; longitude?: number | null; googlePlaceId?: string | null; mapDisplayMode?: string | null;
};

type State = {
  emirate: string; city: string; community: string; area: string; address: string;
  latitude: string; longitude: string; googlePlaceId: string; mapDisplayMode: MapDisplayMode;
};

const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";
const textareaClass = "min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";

function initialState(values: LocationFieldValues | null | undefined, defaultMode: MapDisplayMode): State {
  return {
    emirate: values?.emirate ?? "", city: values?.city ?? "", community: values?.community ?? "", area: values?.area ?? "",
    address: values?.address ?? "", latitude: values?.latitude == null ? "" : String(values.latitude),
    longitude: values?.longitude == null ? "" : String(values.longitude), googlePlaceId: values?.googlePlaceId ?? "",
    mapDisplayMode: (mapDisplayModes as readonly string[]).includes(values?.mapDisplayMode ?? "") ? values!.mapDisplayMode as MapDisplayMode : defaultMode,
  };
}

function newSessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

type FieldName = "address" | "latitude" | "longitude" | "googlePlaceId";

const missingLabels = {emirate: "emirate", city: "city", community: "community", address: "street address"} as const;

/**
 * Location section for project, property and developer forms. Every value is
 * rendered as a named form control, so the parent form's FormData and Zod
 * validation stay the single submission path. `requireUae` applies the UAE
 * coordinate check (properties always; projects and developers when their
 * country is AE). `addressOnly` renders just the address, pin and coordinates
 * (for a developer head office, which is always shown exactly), and `names`
 * renames those controls to match the parent form's fields.
 */
export function LocationFields({organizationId, values, errors, defaultMode = "EXACT", requireUae = true, recordLabel, addressOnly = false, names = {}}: {
  organizationId: string; values?: LocationFieldValues | null; errors: Record<string, string>;
  defaultMode?: MapDisplayMode; requireUae?: boolean; recordLabel: string;
  addressOnly?: boolean; names?: Partial<Record<FieldName, string>>;
}) {
  const nameOf = (field: FieldName) => names[field] ?? field;
  const [state, setState] = useState<State>(() => initialState(values, defaultMode));
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [busy, setBusy] = useState<"" | "search" | "place" | "geocode" | "reverse">("");
  const [notice, setNotice] = useState<{tone: "error" | "info"; text: string} | null>(null);
  const sessionToken = useRef<string | null>(null);
  const searchSequence = useRef(0);
  const listId = useId();

  const latitude = state.latitude.trim() === "" ? null : Number(state.latitude);
  const longitude = state.longitude.trim() === "" ? null : Number(state.longitude);
  const hasPoint = latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude);
  const outsideUae = requireUae && hasPoint && !isWithinUae(latitude, longitude);

  const update = (patch: Partial<State>) => setState(current => ({...current, ...patch}));
  const setPoint = (lat: number, lng: number) => update({latitude: String(roundCoordinate(lat)), longitude: String(roundCoordinate(lng)), googlePlaceId: ""});

  function applyPlace(place: NormalizedPlace, {keepPin = false}: {keepPin?: boolean} = {}) {
    if (requireUae && !place.withinUae) { setNotice({tone: "error", text: "That result is outside the United Arab Emirates and was not applied."}); return; }
    setState(current => ({
      ...current,
      emirate: place.emirate ?? current.emirate, city: place.city ?? current.city,
      community: place.community ?? current.community, area: place.area ?? current.area,
      address: place.formattedAddress ?? current.address,
      latitude: keepPin ? current.latitude : String(place.latitude), longitude: keepPin ? current.longitude : String(place.longitude),
      googlePlaceId: keepPin ? "" : place.placeId ?? "",
    }));
    const missing = place.missingFields.filter(field => !addressOnly || field === "address").map(field => missingLabels[field]);
    const base = keepPin ? "Address details were filled from the pin." : "Location filled from Google Maps.";
    setNotice({tone: "info", text: missing.length
      ? `${base} Google did not provide the ${missing.join(", ")}; enter ${missing.length === 1 ? "it" : "them"} manually before saving.`
      : `${base} Review the details${keepPin ? "" : " and adjust the pin if needed"} before saving.`});
  }

  useEffect(() => {
    const input = query.trim();
    const sequence = ++searchSequence.current;
    if (input.length < 3) return;
    const timer = window.setTimeout(async () => {
      sessionToken.current ??= newSessionToken();
      setBusy("search");
      try {
        const result = await mapLookup.autocomplete(organizationId, input, sessionToken.current);
        if (sequence !== searchSequence.current) return;
        setSuggestions(result.suggestions); setActiveIndex(-1);
        if (!result.suggestions.length) setNotice({tone: "info", text: "No UAE places match this search. Try a building, community or street name."});
        else setNotice(null);
      } catch (error) {
        if (sequence === searchSequence.current) { setSuggestions([]); setNotice({tone: "error", text: error instanceof Error ? error.message : "Address search failed."}); }
      } finally { if (sequence === searchSequence.current) setBusy(""); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query, organizationId]);

  async function choose(suggestion: PlaceSuggestion) {
    setSuggestions([]); setQuery(""); setBusy("place");
    searchSequence.current++;
    try {
      const {place} = await mapLookup.place(organizationId, suggestion.placeId, sessionToken.current);
      applyPlace(place);
    } catch (error) { setNotice({tone: "error", text: error instanceof Error ? error.message : "That place could not be loaded."}); }
    finally { sessionToken.current = null; setBusy(""); }
  }

  async function locateAddress() {
    const text = [state.address, describeLocation(state)].filter(Boolean).join(", ");
    if (text.trim().length < 3) { setNotice({tone: "error", text: "Enter an address, community or emirate first."}); return; }
    setBusy("geocode");
    try {
      const {places} = await mapLookup.geocode(organizationId, text.slice(0, 500));
      const match = places.find(place => !requireUae || place.withinUae);
      if (!match) setNotice({tone: "error", text: "No UAE location was found for this address. Place the pin on the map or enter coordinates."});
      else { applyPlace({...match, formattedAddress: state.address || match.formattedAddress}); }
    } catch (error) { setNotice({tone: "error", text: error instanceof Error ? error.message : "The address could not be located."}); }
    finally { setBusy(""); }
  }

  async function fillFromPin() {
    if (!hasPoint || outsideUae) return;
    setBusy("reverse");
    try {
      const {place} = await mapLookup.reverseGeocode(organizationId, latitude, longitude);
      if (!place) setNotice({tone: "info", text: "Google Maps has no address for this pin. Enter the address manually."});
      else applyPlace(place, {keepPin: true});
    } catch (error) { setNotice({tone: "error", text: error instanceof Error ? error.message : "Address details could not be loaded for this pin."}); }
    finally { setBusy(""); }
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); if (activeIndex >= 0 && suggestions[activeIndex]) void choose(suggestions[activeIndex]); return; }
    if (event.key === "Escape") { setSuggestions([]); return; }
    if (!suggestions.length || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    setActiveIndex(index => event.key === "ArrowDown" ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1));
  }

  const markers = useMemo(() => hasPoint && !outsideUae
    ? [{id: "location", latitude: latitude!, longitude: longitude!, title: recordLabel, precision: "EXACT" as const}] : [],
  [hasPoint, outsideUae, latitude, longitude, recordLabel]);

  const fieldError = (name: string) => errors[name] ? <p id={`${name}-error`} className="text-xs text-destructive">{errors[name]}</p> : null;
  const [addressName, latitudeName, longitudeName] = [nameOf("address"), nameOf("latitude"), nameOf("longitude")];
  const text = (name: "city" | "community" | "area", label: string, max: number) => <div className="space-y-1.5">
    <Label htmlFor={name}>{label}</Label>
    <Input id={name} name={name} value={state[name]} maxLength={max} onChange={event => update({[name]: event.target.value})} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `${name}-error` : undefined} />
    {fieldError(name)}
  </div>;

  return <div className="space-y-5">
    <div className="relative space-y-1.5">
      <Label htmlFor="location-search">Search address or place</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input id="location-search" value={query} onChange={event => { setQuery(event.target.value); if (event.target.value.trim().length < 3) setSuggestions([]); }} onKeyDown={onSearchKey} autoComplete="off" placeholder="Building, community or street in the UAE"
          className="pl-9" role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined} />
        {(busy === "search" || busy === "place") && <LoaderCircle className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Searching" />}
      </div>
      {suggestions.length > 0 && <ul id={listId} role="listbox" aria-label="Address suggestions" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-lg">
        {suggestions.map((suggestion, index) => <li key={suggestion.placeId} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}
          onMouseDown={event => { event.preventDefault(); void choose(suggestion); }}
          className={`cursor-pointer rounded-md px-3 py-2 text-sm ${index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
          <span className="font-medium">{suggestion.primaryText}</span>{suggestion.secondaryText && <span className="block text-xs text-muted-foreground">{suggestion.secondaryText}</span>}
        </li>)}
      </ul>}
      <p className="text-xs text-muted-foreground">Selecting a result fills the address fields and coordinates. You can still edit every field.</p>
    </div>
    {notice && <p role={notice.tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-xs ${notice.tone === "error" ? "border-destructive/30 bg-destructive/5 text-destructive" : "bg-muted/30 text-muted-foreground"}`}>{notice.text}</p>}

    <div className="grid gap-4 sm:grid-cols-2">
      {!addressOnly && <>
      <div className="space-y-1.5">
        <Label htmlFor="emirate">Emirate</Label>
        <select id="emirate" name="emirate" value={state.emirate} onChange={event => update({emirate: event.target.value})} className={selectClass} aria-invalid={Boolean(errors.emirate)}>
          <option value="">Not specified</option>{emirates.map(value => <option key={value} value={value}>{emirateLabels[value]}</option>)}
        </select>{fieldError("emirate")}
      </div>
      {text("city", "City", 120)}
      {text("community", "Community", 160)}
      {text("area", "Area / sub-community", 160)}
      </>}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor={addressName}>{addressOnly ? "Head office address" : "Address"}</Label>
        <textarea id={addressName} name={addressName} value={state.address} maxLength={1000} onChange={event => update({address: event.target.value})} className={textareaClass} aria-invalid={Boolean(errors[addressName])} />
        {fieldError(addressName)}
      </div>
    </div>

    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Map location</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={locateAddress} disabled={Boolean(busy)}>{busy === "geocode" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <MapPin aria-hidden="true" />}Locate address</Button>
          <Button type="button" variant="outline" size="sm" onClick={fillFromPin} disabled={Boolean(busy) || !hasPoint || outsideUae}>{busy === "reverse" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Crosshair aria-hidden="true" />}Fill address from pin</Button>
          {hasPoint && <Button type="button" variant="ghost" size="sm" onClick={() => update({latitude: "", longitude: "", googlePlaceId: ""})}><X aria-hidden="true" />Clear pin</Button>}
        </div>
      </div>
      <MapCanvas markers={markers} onPositionChange={setPoint} label={`Map preview for ${recordLabel}`} className="h-72"
        unavailable="Set NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY to preview and adjust the pin. Coordinates can still be entered below." />
      <p className="text-xs text-muted-foreground">{hasPoint ? "Drag the pin or click the map to adjust the exact position." : "Search for a place, locate the address, or click the map to place a pin."}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={latitudeName}>Latitude</Label>
          <Input id={latitudeName} name={latitudeName} type="number" step="any" min={-90} max={90} value={state.latitude} onChange={event => update({latitude: event.target.value, googlePlaceId: ""})} aria-invalid={Boolean(errors[latitudeName]) || outsideUae} aria-describedby={errors[latitudeName] ? `${latitudeName}-error` : undefined} />
          {fieldError(latitudeName)}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={longitudeName}>Longitude</Label>
          <Input id={longitudeName} name={longitudeName} type="number" step="any" min={-180} max={180} value={state.longitude} onChange={event => update({longitude: event.target.value, googlePlaceId: ""})} aria-invalid={Boolean(errors[longitudeName]) || outsideUae} aria-describedby={errors[longitudeName] ? `${longitudeName}-error` : undefined} />
          {fieldError(longitudeName)}
        </div>
      </div>
      {outsideUae && !errors[latitudeName] && <p role="alert" className="text-xs text-destructive">These coordinates are outside the United Arab Emirates. Check that latitude and longitude are not swapped.</p>}
      <input type="hidden" name={nameOf("googlePlaceId")} value={state.googlePlaceId} />
    </div>

    {!addressOnly && <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Map visibility</legend>
      <p className="text-xs text-muted-foreground">Controls how this location appears on maps and map links. Administrators can always see the stored coordinates.</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {mapDisplayModes.map(mode => <label key={mode} className={`flex cursor-pointer gap-2 rounded-lg border p-3 text-sm ${state.mapDisplayMode === mode ? "border-primary bg-primary/5" : ""}`}>
          <input type="radio" name="mapDisplayMode" value={mode} checked={state.mapDisplayMode === mode} onChange={() => update({mapDisplayMode: mode})} className="mt-0.5" />
          <span><span className="font-medium">{mapDisplayModeLabels[mode].label}</span><span className="block text-xs text-muted-foreground">{mapDisplayModeLabels[mode].description}</span></span>
        </label>)}
      </div>
      {fieldError("mapDisplayMode")}
    </fieldset>}
  </div>;
}
