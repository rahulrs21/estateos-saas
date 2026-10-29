import Link from "next/link";
import { Fragment, useMemo, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "../markdown";

function renderInline(nodes: Inline[], key = "i"): ReactNode {
  return nodes.map((node, index) => {
    const id = `${key}-${index}`;
    switch (node.type) {
      case "text": return <Fragment key={id}>{node.text}</Fragment>;
      case "strong": return <strong key={id} className="font-semibold">{renderInline(node.children, id)}</strong>;
      case "em": return <em key={id}>{renderInline(node.children, id)}</em>;
      case "code": return <code key={id} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{node.text}</code>;
      case "link": return node.external
        ? <a key={id} href={node.href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-2">{renderInline(node.children, id)}</a>
        : <Link key={id} href={node.href} className="font-medium text-primary underline underline-offset-2">{renderInline(node.children, id)}</Link>;
    }
  });
}

function renderLines(lines: Inline[][], key: string) {
  return lines.map((line, index) => <Fragment key={`${key}-${index}`}>{index > 0 && <br />}{renderInline(line, `${key}-${index}`)}</Fragment>);
}

function renderBlock(block: Block, index: number): ReactNode {
  const key = `b-${index}`;
  switch (block.type) {
    case "heading": {
      const className = "mt-4 mb-2 font-semibold first:mt-0";
      if (block.level === 1) return <h3 key={key} className={`${className} text-base`}>{renderInline(block.children, key)}</h3>;
      return <h4 key={key} className={`${className} text-sm`}>{renderInline(block.children, key)}</h4>;
    }
    case "paragraph": return <p key={key} className="my-2 first:mt-0 last:mb-0">{renderLines(block.children, key)}</p>;
    case "list": {
      const items = block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`} className="pl-1">{renderInline(item, `${key}-${itemIndex}`)}</li>);
      return block.ordered
        ? <ol key={key} start={block.start} className="my-2 list-decimal space-y-1 pl-5">{items}</ol>
        : <ul key={key} className="my-2 list-disc space-y-1 pl-5">{items}</ul>;
    }
    case "code": return <pre key={key} className="my-3 overflow-x-auto rounded-lg border bg-muted/60 p-3 text-xs leading-5"><code className="font-mono">{block.text}</code></pre>;
    case "table": return <div key={key} className="my-3 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <thead className="bg-muted/60"><tr>{block.header.map((cell, cellIndex) => <th key={cellIndex} scope="col" className="border-b px-3 py-2 font-semibold">{renderInline(cell, `${key}-h${cellIndex}`)}</th>)}</tr></thead>
        <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b last:border-b-0">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-3 py-2 align-top">{renderInline(cell, `${key}-${rowIndex}-${cellIndex}`)}</td>)}</tr>)}</tbody>
      </table>
    </div>;
    case "quote": return <blockquote key={key} className="my-2 border-l-2 pl-3 text-muted-foreground">{renderLines(block.children, key)}</blockquote>;
    case "rule": return <hr key={key} className="my-3" />;
  }
}

export function MarkdownView({source}: {source: string}) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  return <div className="text-sm leading-6 break-words">{blocks.map(renderBlock)}</div>;
}
