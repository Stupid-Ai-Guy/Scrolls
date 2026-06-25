"use client";

import katex from "katex";

type Segment =
  | { type: "text"; value: string }
  | { type: "math"; value: string; display: boolean };

// Splits a string into alternating text and math segments. Math is delimited
// by `$...$` (inline) or `$$...$$` (display). `\$` escapes a literal dollar
// sign. An unmatched opening delimiter is treated as plain text.
function parseSegments(src: string): Segment[] {
  const segments: Segment[] = [];
  let buf = "";
  let i = 0;
  const flush = () => {
    if (buf) {
      segments.push({ type: "text", value: buf });
      buf = "";
    }
  };
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && src[i + 1] === "$") {
      buf += "$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = src[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const start = i + delim.length;
      // Find the matching closing delimiter, skipping escaped \$.
      let end = -1;
      let j = start;
      while (j < src.length) {
        if (src[j] === "\\" && src[j + 1] === "$") {
          j += 2;
          continue;
        }
        if (display) {
          if (src[j] === "$" && src[j + 1] === "$") {
            end = j;
            break;
          }
        } else if (src[j] === "$") {
          end = j;
          break;
        }
        j++;
      }
      if (end === -1) {
        // No closing delim — render the rest as plain text.
        buf += src.slice(i);
        i = src.length;
        continue;
      }
      flush();
      segments.push({
        type: "math",
        value: src.slice(start, end),
        display,
      });
      i = end + delim.length;
      continue;
    }
    buf += ch;
    i++;
  }
  flush();
  return segments;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Memoize rendered math by `${display}:${value}` so repeated renders of the
// same expression skip KaTeX entirely.
const KATEX_CACHE_LIMIT = 256;
const katexCache = new Map<string, string>();

function renderMath(src: string, display: boolean): string {
  const key = `${display ? "d" : "i"}:${src}`;
  const hit = katexCache.get(key);
  if (hit !== undefined) return hit;
  let html: string;
  try {
    html = katex.renderToString(src, {
      throwOnError: false,
      displayMode: display,
      output: "html",
    });
  } catch {
    html = `<span style="color:#fb7185">${escapeHtml(src)}</span>`;
  }
  if (katexCache.size >= KATEX_CACHE_LIMIT) {
    const oldest = katexCache.keys().next().value;
    if (oldest !== undefined) katexCache.delete(oldest);
  }
  katexCache.set(key, html);
  return html;
}

// Renders a string with inline (`$...$`) and display (`$$...$$`) LaTeX math.
// Plain text segments are emitted as-is; whitespace is preserved by the
// containing element (use white-space: pre-wrap on the parent if you want
// newlines to render as line breaks).
export function RichText({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const segments = parseSegments(source);
  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={i}>{seg.value}</span>;
        }
        return (
          <span
            key={i}
            dangerouslySetInnerHTML={{ __html: renderMath(seg.value, seg.display) }}
          />
        );
      })}
    </span>
  );
}
