"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { AdPlatformLimits, TextLimit } from "../ad-limits";
import { CONTENT_CATALOG, type ContentLocale, type ContentType, type FieldDefinition } from "../catalog";

/**
 * Editable fields and read-only previews for every content type. All draft
 * text is rendered as React text nodes (escaped), never as HTML, so generated
 * or edited content cannot inject markup or scripts.
 */

export const textareaClass = "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-6 shadow-xs outline-none field-sizing-content placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

type Content = Record<string, unknown>;
interface AdVariant { primaryText: string; headlines: string[]; descriptions: string[]; callToAction: string }
interface ProposalProperty { reference: string; summary: string; priceAndSpecifications: string; locationHighlights: string; advantages: string[] }

const asString = (value: unknown) => typeof value === "string" ? value : "";
const asList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

export const localeProps = (locale: ContentLocale) => locale === "ar" ? {dir: "rtl" as const, lang: "ar"} : {dir: "ltr" as const, lang: "en"};

function Counter({value, limit}: {value: string; limit?: TextLimit | null}) {
  if (!limit) return <span className="text-xs text-muted-foreground tabular-nums">{value.length}</span>;
  const over = value.length > limit.max;
  return <span className={cn("text-xs tabular-nums", over ? "font-medium text-destructive" : "text-muted-foreground")}>
    {value.length}/{limit.max}{limit.kind === "recommended" ? " recommended" : ""}
  </span>;
}

function ListEditor({id, items, onChange, disabled, max, limit, itemLabel}: {id: string; items: string[]; onChange: (items: string[]) => void; disabled: boolean; max: number; limit?: TextLimit | null; itemLabel: string}) {
  return <div className="space-y-2">
    {items.map((item, index) => <div key={index} className="flex items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <Input id={index === 0 ? id : undefined} aria-label={`${itemLabel} ${index + 1}`} value={item} maxLength={max} disabled={disabled}
          onChange={event => onChange(items.map((current, position) => position === index ? event.target.value : current))} />
        {limit !== undefined && <div className="flex justify-end"><Counter value={item} limit={limit} /></div>}
      </div>
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}><X className="size-4" /></Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" disabled={disabled || items.length >= 20} onClick={() => onChange([...items, ""])}><Plus className="size-4" />Add {itemLabel.toLowerCase()}</Button>
  </div>;
}

function TextField({id, field, value, onChange, disabled}: {id: string; field: FieldDefinition; value: string; onChange: (value: string) => void; disabled: boolean}) {
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2"><Label htmlFor={id}>{field.label}</Label><Counter value={value} /></div>
    {field.kind === "line"
      ? <Input id={id} value={value} maxLength={field.max} disabled={disabled} onChange={event => onChange(event.target.value)} />
      : <textarea id={id} className={cn(textareaClass, "min-h-24")} value={value} maxLength={field.max} disabled={disabled} onChange={event => onChange(event.target.value)} />}
  </div>;
}

/** Edits one language version of a draft. */
export function FieldsEditor({type, locale, content, onChange, disabled, adLimits}: {type: ContentType; locale: ContentLocale; content: Content; onChange: (content: Content) => void; disabled: boolean; adLimits: AdPlatformLimits | null}) {
  const set = (key: string, value: unknown) => onChange({...content, [key]: value});
  const prefix = `content-${locale}`;
  return <div className="space-y-5" {...localeProps(locale)}>
    {CONTENT_CATALOG[type].fields.map(field => {
      const id = `${prefix}-${field.key}`;
      if (field.kind === "line" || field.kind === "text") return <TextField key={field.key} id={id} field={field} value={asString(content[field.key])} onChange={value => set(field.key, value)} disabled={disabled} />;
      if (field.kind === "list") return <div key={field.key} className="space-y-1.5"><Label htmlFor={id}>{field.label}</Label>
        <ListEditor id={id} items={asList(content[field.key])} onChange={items => set(field.key, items)} disabled={disabled} max={field.max} itemLabel={field.key === "hashtags" ? "Hashtag" : "Item"} /></div>;
      if (field.kind === "adVariants") {
        const variants = (Array.isArray(content.variants) ? content.variants : []) as AdVariant[];
        const update = (index: number, patch: Partial<AdVariant>) => set("variants", variants.map((variant, position) => position === index ? {...variant, ...patch} : variant));
        return <div key={field.key} className="space-y-4">
          {variants.map((variant, index) => <fieldset key={index} className="space-y-3 rounded-xl border p-4">
            <legend className="px-1 text-sm font-semibold">Variant {index + 1}</legend>
            {(adLimits?.primaryText || variant.primaryText) && <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2"><Label htmlFor={`${id}-${index}-primary`}>Primary text</Label><Counter value={variant.primaryText} limit={adLimits?.primaryText} /></div>
              <textarea id={`${id}-${index}-primary`} className={cn(textareaClass, "min-h-20")} value={variant.primaryText} maxLength={1000} disabled={disabled} onChange={event => update(index, {primaryText: event.target.value})} />
            </div>}
            {(adLimits?.headline || variant.headlines.length > 0) && <div className="space-y-1.5"><Label htmlFor={`${id}-${index}-headline`}>Headlines</Label>
              <ListEditor id={`${id}-${index}-headline`} items={variant.headlines} onChange={headlines => update(index, {headlines})} disabled={disabled} max={200} limit={adLimits?.headline ?? null} itemLabel="Headline" /></div>}
            {(adLimits?.description || variant.descriptions.length > 0) && <div className="space-y-1.5"><Label htmlFor={`${id}-${index}-description`}>Descriptions</Label>
              <ListEditor id={`${id}-${index}-description`} items={variant.descriptions} onChange={descriptions => update(index, {descriptions})} disabled={disabled} max={400} limit={adLimits?.description ?? null} itemLabel="Description" /></div>}
            <div className="space-y-1.5"><Label htmlFor={`${id}-${index}-cta`}>Call to action</Label>
              <Input id={`${id}-${index}-cta`} value={variant.callToAction} maxLength={200} disabled={disabled} onChange={event => update(index, {callToAction: event.target.value})} /></div>
          </fieldset>)}
        </div>;
      }
      const properties = (Array.isArray(content.properties) ? content.properties : []) as ProposalProperty[];
      const update = (index: number, patch: Partial<ProposalProperty>) => set("properties", properties.map((item, position) => position === index ? {...item, ...patch} : item));
      return <div key={field.key} className="space-y-4">
        {properties.map((item, index) => <fieldset key={index} className="space-y-3 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">Option {index + 1}: {item.reference}</legend>
          {(["summary", "priceAndSpecifications", "locationHighlights"] as const).map(key => <div key={key} className="space-y-1.5">
            <Label htmlFor={`${id}-${index}-${key}`}>{key === "summary" ? "Summary" : key === "priceAndSpecifications" ? "Price and specifications" : "Location"}</Label>
            <textarea id={`${id}-${index}-${key}`} className={cn(textareaClass, "min-h-16")} value={item[key]} maxLength={1500} disabled={disabled} onChange={event => update(index, {[key]: event.target.value})} />
          </div>)}
          <div className="space-y-1.5"><Label htmlFor={`${id}-${index}-advantages`}>Advantages</Label>
            <ListEditor id={`${id}-${index}-advantages`} items={item.advantages} onChange={advantages => update(index, {advantages})} disabled={disabled} max={400} itemLabel="Advantage" /></div>
        </fieldset>)}
      </div>;
    })}
  </div>;
}

// --- Previews ------------------------------------------------------------------

const Paragraphs = ({text, className}: {text: string; className?: string}) => text.trim() ? <p className={cn("whitespace-pre-wrap leading-7", className)}>{text}</p> : null;

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return <section className="space-y-2"><h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>{children}</section>;
}

function Bullets({items}: {items: string[]}) {
  const visible = items.filter(item => item.trim());
  return visible.length ? <ul className="list-disc space-y-1 ps-5 leading-7">{visible.map((item, index) => <li key={index}>{item}</li>)}</ul> : null;
}

function DocumentPreview({type, content}: {type: ContentType; content: Content}) {
  return <div className="space-y-5">
    {CONTENT_CATALOG[type].fields.map(field => {
      const value = content[field.key];
      if (field.kind === "list") {
        const items = asList(value);
        if (!items.length) return null;
        return <Section key={field.key} title={field.label}>
          {field.key === "hashtags" ? <p className="flex flex-wrap gap-2 text-sm text-primary">{items.map((tag, index) => <span key={index}>{tag}</span>)}</p> : <Bullets items={items} />}
        </Section>;
      }
      if (field.kind === "line" || field.kind === "text") {
        const text = asString(value);
        if (!text.trim()) return null;
        if (field.key === "listingTitle") return <h3 key={field.key} className="text-xl font-semibold leading-8">{text}</h3>;
        return <Section key={field.key} title={field.label}><Paragraphs text={text} /></Section>;
      }
      return null;
    })}
  </div>;
}

function EmailPreview({content, from}: {content: Content; from: string}) {
  return <div className="overflow-hidden rounded-xl border bg-background">
    <div className="space-y-1 border-b bg-muted/40 px-4 py-3 text-sm">
      <p><span className="text-muted-foreground">From: </span>{from}</p>
      <p className="font-semibold">{asString(content.subject) || "(no subject)"}</p>
      {asString(content.previewText) && <p className="text-muted-foreground">{asString(content.previewText)}</p>}
    </div>
    <div className="space-y-4 px-4 py-5 text-sm">
      <Paragraphs text={asString(content.body)} />
      {asString(content.callToAction) && <p className="inline-block rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground">{asString(content.callToAction)}</p>}
    </div>
  </div>;
}

function WhatsAppPreview({content}: {content: Content}) {
  const versions = [["shortVersion", "Short"], ["professionalVersion", "Professional"], ["friendlyVersion", "Friendly"]] as const;
  return <div className="space-y-4 rounded-xl bg-[#e7ddd3] p-4 dark:bg-[#0b141a]">
    {versions.map(([key, label]) => asString(content[key]).trim() ? <div key={key} className="space-y-1">
      <p className="text-xs font-medium text-[#54656f] dark:text-[#8696a0]">{label} version</p>
      <div className="ms-auto max-w-[85%] rounded-lg rounded-se-none bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
        <Paragraphs text={asString(content[key])} className="leading-6" />
      </div>
    </div> : null)}
  </div>;
}

function SocialPreview({content}: {content: Content}) {
  const hashtags = asList(content.hashtags).join(" ");
  const posts = [["instagramCaption", "Instagram"], ["facebookCaption", "Facebook"], ["linkedinUpdate", "LinkedIn"], ["propertyAnnouncement", "Announcement"]] as const;
  return <div className="grid gap-4 md:grid-cols-2">
    {posts.map(([key, label]) => asString(content[key]).trim() ? <article key={key} className="space-y-3 rounded-xl border bg-background p-4 text-sm">
      <h4 className="font-semibold">{label}</h4>
      <Paragraphs text={asString(content[key])} className="leading-6" />
      {hashtags && key !== "linkedinUpdate" && <p className="text-primary">{hashtags}</p>}
    </article> : null)}
    {asString(content.reelScript).trim() && <article className="space-y-3 rounded-xl border bg-background p-4 text-sm md:col-span-2"><h4 className="font-semibold">Short video / reel script</h4><Paragraphs text={asString(content.reelScript)} className="leading-6" /></article>}
  </div>;
}

function AdPreview({content, platform}: {content: Content; platform: AdPlatformLimits | null}) {
  const variants = (Array.isArray(content.variants) ? content.variants : []) as AdVariant[];
  return <div className="grid gap-4 md:grid-cols-2">
    {variants.map((variant, index) => <article key={index} className="space-y-2 rounded-xl border bg-background p-4 text-sm">
      <p className="text-xs font-medium text-muted-foreground">{platform?.label ?? "Ad"} · Variant {index + 1} · Sponsored</p>
      {variant.headlines.filter(Boolean).length > 0 && <p className="font-semibold text-primary">{variant.headlines.filter(Boolean).join(" | ")}</p>}
      <Paragraphs text={variant.primaryText} className="leading-6" />
      {variant.descriptions.filter(Boolean).map((description, position) => <p key={position} className="text-muted-foreground">{description}</p>)}
      {variant.callToAction && <p className="inline-block rounded-md border px-3 py-1 text-xs font-medium">{variant.callToAction}</p>}
    </article>)}
  </div>;
}

function ProposalPreview({content}: {content: Content}) {
  const properties = (Array.isArray(content.properties) ? content.properties : []) as ProposalProperty[];
  return <div className="space-y-5 text-sm">
    <Paragraphs text={asString(content.introduction)} />
    {asString(content.comparisonSummary).trim() && <Section title="Comparison"><Paragraphs text={asString(content.comparisonSummary)} /></Section>}
    {properties.map((item, index) => <article key={index} className="space-y-2 rounded-xl border p-4">
      <h4 className="font-semibold">Option {index + 1}: {item.reference}</h4>
      <Paragraphs text={item.summary} />
      <Paragraphs text={item.priceAndSpecifications} className="text-muted-foreground" />
      <Paragraphs text={item.locationHighlights} className="text-muted-foreground" />
      <Bullets items={item.advantages} />
    </article>)}
    {asString(content.nextSteps).trim() && <Section title="Suggested next steps"><Paragraphs text={asString(content.nextSteps)} /></Section>}
  </div>;
}

export function ContentPreview({type, locale, content, from, adLimits}: {type: ContentType; locale: ContentLocale; content: Content; from: string; adLimits: AdPlatformLimits | null}) {
  return <div {...localeProps(locale)} className="text-sm">
    {type === "EMAIL" ? <EmailPreview content={content} from={from} />
      : type === "WHATSAPP_MESSAGE" ? <WhatsAppPreview content={content} />
        : type === "SOCIAL_MEDIA" ? <SocialPreview content={content} />
          : type === "ADVERTISING" ? <AdPreview content={content} platform={adLimits} />
            : type === "CLIENT_PROPOSAL" ? <ProposalPreview content={content} />
              : <DocumentPreview type={type} content={content} />}
  </div>;
}
