"use client";

/* eslint-disable @next/next/no-img-element -- Thumbnails of CRM photos (authorized route) and stock photos (responsive CDN URLs). */
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Archive, Film, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { errorMessage, websitesDelete, websitesGet, websitesUpload } from "../../client";
import { websiteMediaPath, type LinkedData, type LinkedUpload } from "../../linked";
import type { ImageRef, VideoRef } from "../../registry";
import { isStockImageRef, isUploadImageRef, isUploadVideoRef } from "../../registry";
import { STOCK_IMAGES, STOCK_TAGS, STOCK_TAG_LABELS, STOCK_VIDEOS, stockImage, stockImageUrl, type StockTag } from "../../stock";
import { MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, UPLOAD_TYPES, VIDEO_UPLOAD_TYPES, isImageUploadType, isVideoUploadType } from "../../uploads";
import { Field, inputClass } from "./controls";
import { useEditorServices } from "./editor-context";

/*
 * Image and video choices for the editor: photos of the page's linked CRM
 * records (approved, authorized), the company's website library (uploads)
 * and the curated stock library. Pages store only the ID; the renderer
 * builds every URL.
 */

function thumbnail(ref: ImageRef | null, linked: LinkedData) {
  if (!ref) return null;
  if (isStockImageRef(ref)) { const item = stockImage(ref.stockId); return item ? stockImageUrl(item, 400) : null; }
  if (isUploadImageRef(ref)) return (linked.uploads ?? []).find(upload => upload.id === ref.uploadId)?.url ?? websiteMediaPath(ref.uploadId);
  return linked.media.find(media => media.id === ref.mediaId)?.url ?? null;
}

export function ImagePicker({label, value, onChange, linked, allowNone = true, hint}: {label: string; value: ImageRef | null; onChange: (value: ImageRef | null) => void; linked: LinkedData; allowNone?: boolean; hint?: string}) {
  const [open, setOpen] = useState(false);
  const photos = linked.media.filter(media => media.kind === "PHOTO");
  const [tab, setTab] = useState<"uploads" | "crm" | "stock">(photos.length ? "crm" : "uploads");
  const [tag, setTag] = useState<StockTag | "ALL">("ALL");
  const stock = useMemo(() => tag === "ALL" ? STOCK_IMAGES : STOCK_IMAGES.filter(item => item.tags.includes(tag)), [tag]);
  const current = thumbnail(value, linked);
  const choose = (next: ImageRef) => { onChange(next); setOpen(false); };
  return <Field label={label} hint={hint}>
    <div className="overflow-hidden rounded-md border border-white/10 bg-white/5">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="group relative flex aspect-[16/9] w-full items-center justify-center bg-black/30">
        {current ? <img src={current} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-xs text-zinc-400"><ImageIcon className="size-6" aria-hidden="true" />Choose image</span>}
        <span className="absolute inset-x-0 bottom-0 bg-black/60 py-1.5 text-center text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{current ? "Change image" : "Choose image"}</span>
        {value && isStockImageRef(value) && <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-200">Stock</span>}
      </button>
      {value && <div className="flex items-center gap-2 border-t border-white/10 p-2">
        <input value={value.alt} maxLength={160} aria-label="Image description (alt text)" placeholder="Describe the image" onChange={event => onChange({...value, alt: event.target.value})} className={`${inputClass} h-8 text-xs`} />
        {allowNone && <button type="button" aria-label="Remove image" onClick={() => onChange(null)} className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"><X className="size-4" /></button>}
      </div>}
    </div>
    {open && <div className="space-y-2 rounded-md border border-white/10 bg-zinc-950 p-2">
      <div role="tablist" className="flex gap-1">{(["uploads", "crm", "stock"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)}
        className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${tab === option ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`}>{option === "crm" ? `Project (${photos.length})` : option === "uploads" ? "Uploads" : "Stock"}</button>)}</div>
      {tab === "uploads" ? <UploadLibrary kind="image" onChoose={item => choose({uploadId: item.id, alt: item.alt})} />
        : tab === "crm"
        ? (photos.length ? <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">{photos.map((media, index) => <button key={media.id} type="button" onClick={() => choose({mediaId: media.id, alt: media.alt})} aria-label={`Project photo ${index + 1}`}
          className="relative aspect-square overflow-hidden rounded ring-sky-400 hover:ring-2"><img src={media.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></button>)}</div>
          : <p className="p-3 text-xs text-zinc-400">The linked records have no approved photos. Upload photos on the project or property in the CRM, or use the stock library.</p>)
        : <>
          <select value={tag} onChange={event => setTag(event.target.value as StockTag | "ALL")} aria-label="Stock theme" className={`${inputClass} h-8 text-xs [&>option]:bg-zinc-900`}>
            <option value="ALL">All themes</option>{STOCK_TAGS.map(item => <option key={item} value={item}>{STOCK_TAG_LABELS[item]}</option>)}
          </select>
          <div className="grid max-h-72 grid-cols-3 gap-1.5 overflow-y-auto">{stock.map(item => <button key={item.id} type="button" onClick={() => choose({stockId: item.id, alt: item.alt})} title={item.alt} aria-label={item.alt}
            className="relative aspect-square overflow-hidden rounded ring-sky-400 hover:ring-2"><img src={stockImageUrl(item, 240)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" /></button>)}</div>
          <p className="text-[11px] text-zinc-500">Illustrative stock photos (Unsplash licence). Pages state that stock media is illustrative.</p>
        </>}
    </div>}
  </Field>;
}

export function VideoPicker({label, value, onChange, allowNone = true}: {label: string; value: VideoRef | null; onChange: (value: VideoRef | null) => void; allowNone?: boolean}) {
  const uploaded = value && isUploadVideoRef(value) ? value.uploadId : null;
  const stockId = value && !isUploadVideoRef(value) ? value.stockId : null;
  const [tab, setTab] = useState<"uploads" | "stock">(uploaded ? "uploads" : "stock");
  return <Field label={label} hint={tab === "uploads" ? "Your own videos: MP4 or WebM, up to 50 MB. They play muted and loop; visitors who prefer reduced motion can pause them." : "Illustrative stock videos (Pexels licence). Videos play muted and loop; visitors who prefer reduced motion can pause them."}>
    {uploaded && <div className="relative overflow-hidden rounded-md border border-sky-400/60 bg-black/30">
      <video src={websiteMediaPath(uploaded)} muted playsInline preload="metadata" aria-label="The chosen video" className="aspect-video w-full object-cover" />
      <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-200">Your video</span>
    </div>}
    <div role="tablist" className="flex gap-1">{(["uploads", "stock"] as const).map(option => <button key={option} type="button" role="tab" aria-selected={tab === option} onClick={() => setTab(option)} data-testid={`video-tab-${option}`}
      className={`flex-1 rounded px-2 py-1.5 text-xs font-medium ${tab === option ? "bg-white/15 text-white" : "text-zinc-400 hover:text-white"}`}>{option === "uploads" ? "Uploads" : "Stock"}</button>)}</div>
    {allowNone && <button type="button" onClick={() => onChange(null)} aria-pressed={!value} className={`flex h-9 w-full items-center justify-center rounded border text-xs ${!value ? "border-sky-400 text-white" : "border-white/10 text-zinc-400 hover:text-white"}`}>No video</button>}
    {tab === "uploads" ? <UploadLibrary kind="video" selected={uploaded} onChoose={item => onChange({uploadId: item.id})} />
      : <div className="grid grid-cols-2 gap-1.5">
        {STOCK_VIDEOS.map(item => {
          const poster = stockImage(item.poster);
          return <button key={item.id} type="button" onClick={() => onChange({stockId: item.id})} aria-pressed={stockId === item.id} title={item.title} aria-label={item.title}
            className={`relative aspect-video overflow-hidden rounded border-2 ${stockId === item.id ? "border-sky-400" : "border-transparent"}`}>
            {poster && <img src={stockImageUrl(poster, 320)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/65 px-1.5 py-1 text-left text-[10px] text-white"><Film className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{item.title}</span></span>
          </button>;
        })}
      </div>}
  </Field>;
}

type LibraryItem = LinkedUpload & {fileName: string; canManage: boolean};

const LIBRARY = {
  image: {
    accepted: Object.keys(UPLOAD_TYPES), maxBytes: MAX_UPLOAD_BYTES, matches: isImageUploadType, typeError: "upload a JPEG, PNG or WebP image.", sizeError: "images must be 10 MB or smaller.",
    drop: "Drag images here, or", note: "JPEG, PNG or WebP, up to 10 MB each.", empty: "No uploaded images yet.", inputLabel: "Upload images", testId: "website-media-input", multiple: true,
  },
  video: {
    accepted: Object.keys(VIDEO_UPLOAD_TYPES), maxBytes: MAX_VIDEO_UPLOAD_BYTES, matches: isVideoUploadType, typeError: "upload an MP4 or WebM video.", sizeError: "videos must be 50 MB or smaller.",
    drop: "Drag a video here, or", note: "MP4 or WebM, up to 50 MB. Short, silent loops work best.", empty: "No uploaded videos yet.", inputLabel: "Upload a video", testId: "website-video-input", multiple: false,
  },
} as const;

/** The company's website library (images or videos): upload from the computer (button or drag and drop), choose, archive. */
function UploadLibrary({kind, onChoose, selected = null}: {kind: keyof typeof LIBRARY; onChoose: (item: LinkedUpload) => void; selected?: string | null}) {
  const rules = LIBRARY[kind];
  const {organizationId, previewUpload} = useEditorServices();
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(() => websitesGet<{items: LibraryItem[]}>("/api/websites/media", "The image library could not be loaded.")
    .then(data => { setItems(data.items); setError(null); }, failure => setError(errorMessage(failure, "The image library could not be loaded."))), []);
  useEffect(() => { void load(); }, [load]);
  const pick = (item: LinkedUpload) => { previewUpload({id: item.id, url: item.url, alt: item.alt, width: item.width, height: item.height, contentType: item.contentType}); onChoose(item); };
  const shown = items?.filter(item => rules.matches(item.contentType ?? "")) ?? null;
  const upload = async (files: FileList | File[]) => {
    const list = [...files].slice(0, rules.multiple ? 10 : 1);
    for (const file of list) {
      if (!(rules.accepted as readonly string[]).includes(file.type)) { toast.error(`${file.name}: ${rules.typeError}`); continue; }
      if (file.size > rules.maxBytes) { toast.error(`${file.name}: ${rules.sizeError}`); continue; }
      setBusy(file.name);
      try {
        const created = await websitesUpload<LibraryItem>(file, organizationId);
        setItems(current => [{...created, canManage: true}, ...(current ?? [])]);
        if (list.length === 1) pick(created);
      } catch (failure) { toast.error(errorMessage(failure, `${file.name} could not be uploaded.`)); } finally { setBusy(null); }
    }
  };
  const archive = async (item: LibraryItem) => {
    try {
      await websitesDelete(`/api/websites/media/${item.id}`, organizationId, "The file could not be removed.");
      setItems(current => (current ?? []).filter(row => row.id !== item.id));
      toast.success("Removed from the library. Published pages that use it keep showing it.");
    } catch (failure) { toast.error(errorMessage(failure, "The file could not be removed.")); }
  };
  const onDrop = (event: DragEvent) => { event.preventDefault(); setOver(false); if (event.dataTransfer.files.length) void upload(event.dataTransfer.files); };
  return <div className="space-y-2">
    <div onDragOver={event => { event.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}
      className={`flex flex-col items-center gap-1.5 rounded-md border border-dashed p-4 text-center text-xs transition-colors ${over ? "border-sky-400 bg-sky-500/10 text-white" : "border-white/20 text-zinc-400"}`}>
      {busy ? <Loader2 className="size-5 animate-spin text-sky-300" aria-hidden="true" /> : <Upload className="size-5" aria-hidden="true" />}
      <p>{busy ? `Uploading ${busy}…` : rules.drop}</p>
      <button type="button" disabled={Boolean(busy)} onClick={() => input.current?.click()} className="rounded-md bg-sky-500 px-3 py-1.5 font-semibold text-white hover:bg-sky-400 disabled:opacity-50">Upload from computer</button>
      <p className="text-[10px] text-zinc-500">{rules.note}</p>
      <input ref={input} type="file" accept={rules.accepted.join(",")} multiple={rules.multiple} hidden aria-label={rules.inputLabel} data-testid={rules.testId} onChange={event => { if (event.target.files?.length) void upload(event.target.files); event.target.value = ""; }} />
    </div>
    {error && <p role="alert" className="text-xs text-red-300">{error} <button type="button" className="underline" onClick={() => void load()}>Retry</button></p>}
    {!items && !error && <p className="flex items-center gap-1.5 p-2 text-xs text-zinc-400"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Loading library…</p>}
    {shown && !shown.length && <p className="p-2 text-xs text-zinc-400">{rules.empty}</p>}
    {shown && shown.length > 0 && <div className={`grid max-h-72 gap-1.5 overflow-y-auto ${kind === "video" ? "grid-cols-2" : "grid-cols-3"}`}>{shown.map(item => <div key={item.id} className={`group relative overflow-hidden rounded ${kind === "video" ? "aspect-video" : "aspect-square"}`}>
      <button type="button" onClick={() => pick(item)} aria-label={`Use ${item.fileName}`} aria-pressed={kind === "video" ? selected === item.id : undefined} title={item.fileName}
        className={`absolute inset-0 ring-sky-400 hover:ring-2 ${selected === item.id ? "ring-2" : ""}`}>
        {kind === "video"
          ? <><video src={item.url} muted playsInline preload="metadata" aria-hidden="true" className="pointer-events-none h-full w-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-black/65 px-1.5 py-1 text-left text-[10px] text-white"><Film className="size-3 shrink-0" aria-hidden="true" /><span className="truncate">{item.fileName}</span></span></>
          : <img src={item.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
      </button>
      {item.canManage && <button type="button" onClick={() => void archive(item)} aria-label={`Remove ${item.fileName} from the library`} title="Remove from library"
        className="absolute right-1 top-1 hidden rounded bg-black/70 p-1 text-zinc-200 hover:text-red-300 group-hover:block group-focus-within:block"><Archive className="size-3" /></button>}
    </div>)}</div>}
  </div>;
}
