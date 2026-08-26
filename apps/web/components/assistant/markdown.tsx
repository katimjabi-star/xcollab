import type { ReactElement, ReactNode } from "react";

/* Markdown-lite for assistant prose — bold, inline code, links, and bullet
   lists only (spec §3.2: a small in-repo renderer instead of a dependency).
   Injected link targets are restricted to same-app paths: model output is a
   prompt-injection surface, and an external link inside assistant prose is an
   egress attempt on a sovereign deployment. External URLs render as text. */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;
const LINK = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

function safeHref(href: string): string | null {
  // Same-app absolute paths only; "//host" is a protocol-relative external URL.
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  return null;
}

function renderToken(token: string, key: number): ReactNode {
  if (token.startsWith("**") && token.endsWith("**")) {
    return <strong key={key}>{token.slice(2, -2)}</strong>;
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return (
      <code key={key} dir="ltr">
        {token.slice(1, -1)}
      </code>
    );
  }
  const link = LINK.exec(token);
  if (link) {
    const href = safeHref(link[2] ?? "");
    if (href) {
      return (
        <a key={key} href={href}>
          {link[1]}
        </a>
      );
    }
    return <span key={key}>{link[1]}</span>;
  }
  return token;
}

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((token, i) => renderToken(token, i));
}

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    const last = blocks[blocks.length - 1];
    if (bullet?.[1] !== undefined) {
      if (last && last.kind === "ul") last.items.push(bullet[1]);
      else blocks.push({ kind: "ul", items: [bullet[1]] });
    } else {
      blocks.push({ kind: "p", text: line });
    }
  }
  return blocks;
}

/** Renders assistant text. `dir="auto"` per-block so mixed EN/AR replies
    align each paragraph by its own script. */
export function MarkdownLite({ text }: { text: string }): ReactElement {
  return (
    <>
      {toBlocks(text).map((block, i) =>
        block.kind === "ul" ? (
          <ul key={i} dir="auto">
            {block.items.map((item, j) => (
              <li key={j}>{renderInline(item)}</li>
            ))}
          </ul>
        ) : (
          <p key={i} dir="auto">
            {renderInline(block.text)}
          </p>
        ),
      )}
    </>
  );
}
