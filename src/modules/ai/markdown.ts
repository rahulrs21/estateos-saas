/**
 * A deliberately small Markdown subset for Copilot answers, parsed into a
 * plain tree that React renders as elements. Raw HTML is never interpreted
 * (it stays visible text) and there is no dangerouslySetInnerHTML anywhere.
 * Links are limited to internal EstateOS paths and https URLs.
 */

export type Inline =
  | {type: "text"; text: string}
  | {type: "strong"; children: Inline[]}
  | {type: "em"; children: Inline[]}
  | {type: "code"; text: string}
  | {type: "link"; href: string; external: boolean; children: Inline[]};

export type Block =
  | {type: "heading"; level: 1 | 2 | 3; children: Inline[]}
  | {type: "paragraph"; children: Inline[][]}
  | {type: "list"; ordered: boolean; start: number; items: Inline[][]}
  | {type: "code"; language: string | null; text: string}
  | {type: "table"; header: Inline[][]; rows: Inline[][][]}
  | {type: "quote"; children: Inline[][]}
  | {type: "rule"};

/** Internal app paths or https URLs only; anything else (javascript:, data:, //host) is not a link. */
export function safeHref(raw: string): {href: string; external: boolean} | null {
  const href = raw.trim();
  if (/^\/(?!\/)[A-Za-z0-9\-._~/?#=&%]*$/.test(href)) return {href, external: false};
  try {
    const url = new URL(href);
    if (url.protocol === "https:" && !url.username && !url.password) return {href: url.toString(), external: true};
  } catch { /* not a URL */ }
  return null;
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let buffer = "";
  const flush = () => { if (buffer) { out.push({type: "text", text: buffer}); buffer = ""; } };
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    const char = source[index];
    if (char === "\\" && index + 1 < source.length && /[\\`*_[\]()#|>-]/.test(source[index + 1])) {
      buffer += source[index + 1]; index += 2; continue;
    }
    if (char === "`") {
      const end = source.indexOf("`", index + 1);
      if (end > index + 1) { flush(); out.push({type: "code", text: source.slice(index + 1, end)}); index = end + 1; continue; }
    }
    if (char === "[") {
      const match = /^\[([^\]\n]{1,300})\]\(([^()\s]{1,500})\)/.exec(rest);
      if (match) {
        flush();
        const link = safeHref(match[2]);
        const children = parseInline(match[1]);
        if (link) out.push({type: "link", href: link.href, external: link.external, children});
        else out.push(...children);
        index += match[0].length; continue;
      }
    }
    if (rest.startsWith("**") || rest.startsWith("__")) {
      const marker = rest.slice(0, 2);
      const end = source.indexOf(marker, index + 2);
      if (end > index + 2) { flush(); out.push({type: "strong", children: parseInline(source.slice(index + 2, end))}); index = end + 2; continue; }
    }
    if ((char === "*" || char === "_") && source[index + 1] && source[index + 1] !== " ") {
      const end = source.indexOf(char, index + 1);
      const wordInside = char === "_" && /\w/.test(source[index - 1] ?? "");
      if (end > index + 1 && source[end - 1] !== " " && !wordInside) {
        flush(); out.push({type: "em", children: parseInline(source.slice(index + 1, end))}); index = end + 1; continue;
      }
    }
    buffer += char;
    index += 1;
  }
  flush();
  return out;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split(/(?<!\\)\|/).map(cell => cell.trim());
const isTableDivider = (line: string) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line);

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = /^\s*```\s*([\w+-]{0,30})\s*$/.exec(line);
    if (fence) {
      const body: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) { body.push(lines[index]); index += 1; }
      index += 1;
      blocks.push({type: "code", language: fence[1] || null, text: body.join("\n")});
      continue;
    }
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      blocks.push({type: "heading", level: Math.min(3, heading[1].length) as 1 | 2 | 3, children: parseInline(heading[2])});
      index += 1; continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { blocks.push({type: "rule"}); index += 1; continue; }
    if (line.includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
      const header = splitRow(line).map(parseInline);
      index += 2;
      const rows: Inline[][][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        const cells = splitRow(lines[index]).map(parseInline);
        rows.push(header.map((_, cell) => cells[cell] ?? []));
        index += 1;
      }
      blocks.push({type: "table", header, rows});
      continue;
    }
    const listItem = /^\s*(?:([-*+])|(\d{1,3})[.)])\s+(.*)$/;
    const first = listItem.exec(line);
    if (first) {
      const ordered = Boolean(first[2]);
      const items: Inline[][] = [];
      while (index < lines.length) {
        const match = listItem.exec(lines[index]);
        if (match && Boolean(match[2]) === ordered) { items.push(parseInline(match[3])); index += 1; continue; }
        if (match) { items.push(parseInline(match[3])); index += 1; continue; }
        // Continuation lines of the previous item.
        if (lines[index].trim() && /^\s{2,}\S/.test(lines[index]) && items.length) {
          items[items.length - 1].push({type: "text", text: " "}, ...parseInline(lines[index].trim())); index += 1; continue;
        }
        break;
      }
      blocks.push({type: "list", ordered, start: ordered ? Number(first[2]) : 1, items});
      continue;
    }
    if (/^\s*>/.test(line)) {
      const quote: Inline[][] = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) { quote.push(parseInline(lines[index].replace(/^\s*>\s?/, ""))); index += 1; }
      blocks.push({type: "quote", children: quote});
      continue;
    }
    const paragraph: Inline[][] = [];
    while (index < lines.length && lines[index].trim() && !/^\s*```/.test(lines[index]) && !/^#{1,6}\s/.test(lines[index])
      && !listItem.test(lines[index]) && !/^\s*>/.test(lines[index]) && !(lines[index].includes("|") && index + 1 < lines.length && isTableDivider(lines[index + 1]))) {
      paragraph.push(parseInline(lines[index].trim()));
      index += 1;
    }
    if (paragraph.length) blocks.push({type: "paragraph", children: paragraph});
    else index += 1;
  }
  return blocks;
}
