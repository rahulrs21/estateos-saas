/*
 * WhatsApp message templates (Phase 7B.2, docs/WHATSAPP_INTEGRATION_PLAN.md#templates).
 * Pure: no network, no secrets. Meta's template definitions are reduced to what a
 * member can choose and fill in; the filled blanks are checked against Meta's own
 * rules before anything is drafted or sent, and the same values always render the
 * same text, so the server can tell when a template changed after it was drafted.
 */

export interface MetaTemplateComponent {
  type?: string; format?: string; text?: string;
  example?: {header_text?: string[]; body_text?: string[][]; header_text_named_params?: Array<{param_name?: string; example?: string}>; body_text_named_params?: Array<{param_name?: string; example?: string}>};
  buttons?: Array<{type?: string; text?: string; url?: string; phone_number?: string}>;
}
export interface MetaTemplate { id?: string; name?: string; language?: string; status?: string; category?: string; parameter_format?: string; components?: MetaTemplateComponent[] }

export type TemplatePart = "HEADER" | "BODY";
export interface TemplateVariable {
  /** Unique within the template, for example "BODY:1" or "BODY:first_name". */
  id: string;
  part: TemplatePart;
  /** The placeholder's own name: "1" (positional) or "first_name" (named). */
  key: string;
  example: string | null;
}
export interface WhatsAppTemplate {
  id: string | null; name: string; language: string; status: string; category: string;
  format: "POSITIONAL" | "NAMED";
  header: string | null; body: string; footer: string | null; buttons: Array<{type: string; text: string}>;
  variables: TemplateVariable[];
  /** Whether EstateOS can send it (Phase 7B.2: text header, body, footer and static buttons). */
  supported: boolean; unsupportedReason: string | null;
}

export const TEMPLATE_LIMITS = {value: 1000, header: 60, body: 1024, footer: 60} as const;
const PLACEHOLDER = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;
const NAME = /^[a-z0-9_]{1,100}$/;
const LANGUAGE = /^[a-z]{2,3}(_[A-Z]{2})?$/;
const clean = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, max) : "";

function placeholders(text: string | null) {
  const keys: string[] = [];
  for (const match of (text ?? "").matchAll(PLACEHOLDER)) if (!keys.includes(match[1])) keys.push(match[1]);
  return keys;
}

/** Meta's definition as EstateOS shows and sends it, or null when it is not a valid template at all. */
export function normalizeTemplate(raw: MetaTemplate): WhatsAppTemplate | null {
  const name = typeof raw.name === "string" ? raw.name : "", language = typeof raw.language === "string" ? raw.language : "";
  if (!NAME.test(name) || !LANGUAGE.test(language)) return null;
  const components = Array.isArray(raw.components) ? raw.components.slice(0, 10) : [];
  const find = (type: string) => components.find(item => (item.type ?? "").toUpperCase() === type);
  const reasons: string[] = [];
  const headerPart = find("HEADER");
  const headerFormat = (headerPart?.format ?? "TEXT").toUpperCase();
  if (headerPart && headerFormat !== "TEXT") reasons.push(`a ${headerFormat.toLowerCase()} header`);
  const header = headerPart && headerFormat === "TEXT" ? clean(headerPart.text, 200) || null : null;
  const body = clean(find("BODY")?.text, 2000);
  if (!body) reasons.push("no body text");
  const footer = clean(find("FOOTER")?.text, 200) || null;
  const buttons: Array<{type: string; text: string}> = [];
  for (const button of (find("BUTTONS")?.buttons ?? []).slice(0, 10)) {
    const type = (button.type ?? "").toUpperCase();
    if (type === "URL" && /\{\{/.test(button.url ?? "")) reasons.push("a link button with a blank");
    else if (!["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(type)) reasons.push(`a ${type.toLowerCase().replace(/_/g, " ") || "special"} button`);
    buttons.push({type, text: clean(button.text, 25)});
  }
  for (const item of components) if (!["HEADER", "BODY", "FOOTER", "BUTTONS"].includes((item.type ?? "").toUpperCase())) reasons.push(`a ${(item.type ?? "special").toLowerCase()} part`);
  const format = (raw.parameter_format ?? "").toUpperCase() === "NAMED" ? "NAMED" : "POSITIONAL";
  const variables: TemplateVariable[] = [];
  const examplesFor = (part: TemplatePart, keys: string[]) => {
    const source = part === "HEADER" ? headerPart?.example : find("BODY")?.example;
    return keys.map((key, index) => {
      const named = part === "HEADER" ? source?.header_text_named_params : source?.body_text_named_params;
      const positional = part === "HEADER" ? source?.header_text : source?.body_text?.[0];
      const example = format === "NAMED" ? named?.find(item => item.param_name === key)?.example : positional?.[Number(key) - 1] ?? positional?.[index];
      return {id: `${part}:${key}`, part, key, example: typeof example === "string" ? clean(example, 200) || null : null};
    });
  };
  const headerKeys = placeholders(header), bodyKeys = placeholders(body);
  const keyPattern = format === "NAMED" ? /^[a-z][a-z0-9_]{0,59}$/ : /^\d{1,2}$/;
  if ([...headerKeys, ...bodyKeys].some(key => !keyPattern.test(key))) reasons.push("blanks EstateOS cannot read");
  variables.push(...examplesFor("HEADER", headerKeys), ...examplesFor("BODY", bodyKeys));
  if (variables.length > 20) reasons.push("more than 20 blanks");
  const unique = [...new Set(reasons)];
  return {
    id: typeof raw.id === "string" ? raw.id.slice(0, 40) : null, name, language, status: (raw.status ?? "UNKNOWN").toUpperCase().slice(0, 30), category: (raw.category ?? "").toUpperCase().slice(0, 30),
    format, header, body, footer, buttons, variables, supported: unique.length === 0, unsupportedReason: unique.length ? `It has ${unique.join(", ")}, which EstateOS cannot send yet.` : null,
  };
}

/** Only approved templates EstateOS can send may be chosen. */
export const selectable = (template: WhatsAppTemplate) => template.status === "APPROVED" && template.supported;

export type TemplateValues = Record<string, string>;

/** Problems with the filled blanks, per blank, under Meta's rules (empty means ready). */
export function templateValueProblems(template: WhatsAppTemplate, values: TemplateValues): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const variable of template.variables) {
    const value = values[variable.id] ?? "";
    if (!value.trim()) problems[variable.id] = "Fill this in.";
    else if (value.length > TEMPLATE_LIMITS.value) problems[variable.id] = `Keep it under ${TEMPLATE_LIMITS.value} characters.`;
    else if (/[\n\r\t]/.test(value)) problems[variable.id] = "WhatsApp does not allow line breaks or tabs here.";
    else if (/ {5,}/.test(value)) problems[variable.id] = "WhatsApp allows at most four spaces in a row.";
    else if (/\{\{|\}\}/.test(value)) problems[variable.id] = "Remove the braces.";
  }
  const rendered = renderTemplate(template, values);
  if ((rendered.header ?? "").length > TEMPLATE_LIMITS.header) problems.HEADER = `The header would be longer than ${TEMPLATE_LIMITS.header} characters.`;
  if (rendered.body.length > TEMPLATE_LIMITS.body) problems.BODY = `The message would be longer than ${TEMPLATE_LIMITS.body} characters.`;
  return problems;
}

/** The message as the customer sees it (blanks left empty show as their placeholder). */
export function renderTemplate(template: WhatsAppTemplate, values: TemplateValues) {
  const fill = (text: string, part: TemplatePart) => text.replace(PLACEHOLDER, (whole, key: string) => {
    const value = values[`${part}:${key}`];
    return value && value.trim() ? value.trim() : whole;
  });
  const header = template.header ? fill(template.header, "HEADER") : null;
  const body = fill(template.body, "BODY");
  const buttons = template.buttons.filter(button => button.text).map(button => `[${button.text}]`).join(" ");
  const text = [header, body, template.footer, buttons || null].filter(Boolean).join("\n\n");
  return {header, body, footer: template.footer, text};
}

/** Graph's `components` for sending: header and body parameters, named or positional, in the template's order. */
export function templateComponents(template: WhatsAppTemplate, values: TemplateValues) {
  const parameters = (part: TemplatePart) => template.variables.filter(variable => variable.part === part).map(variable => ({
    type: "text", ...(template.format === "NAMED" ? {parameter_name: variable.key} : {}), text: (values[variable.id] ?? "").trim(),
  }));
  const components: Array<{type: "header" | "body"; parameters: Array<{type: string; text: string; parameter_name?: string}>}> = [];
  const header = parameters("HEADER"), body = parameters("BODY");
  if (header.length) components.push({type: "header", parameters: header});
  if (body.length) components.push({type: "body", parameters: body});
  return components;
}

/** The stored values: only this template's blanks, trimmed. */
export function templateValues(template: WhatsAppTemplate, input: Record<string, unknown> | null | undefined): TemplateValues {
  const values: TemplateValues = {};
  for (const variable of template.variables) {
    const value = input?.[variable.id];
    if (typeof value === "string") values[variable.id] = value.trim().slice(0, TEMPLATE_LIMITS.value);
  }
  return values;
}

export const CATEGORY_LABELS: Record<string, string> = {MARKETING: "Marketing", UTILITY: "Utility", AUTHENTICATION: "Authentication"};
