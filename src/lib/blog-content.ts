import { marked } from "marked";
import katex from "katex";

// Blog bodies are markdown with LaTeX interspersed. We split the source into
// alternating markdown and math segments before feeding it to marked so the
// markdown parser never touches the math (which would otherwise mangle `$`,
// underscores in variable names, backslashes, etc.). Each math segment is
// replaced with an inert placeholder marked won't rewrite, then swapped
// back for the KaTeX-rendered HTML after markdown → HTML conversion.

type MathSegment = { value: string; display: boolean };

// Use invisible-separator control chars so marked treats these as opaque
// text tokens. Wrapping them with `MATH${i}` keeps the placeholder readable
// when debugging and guarantees uniqueness across a single render.
const PLACEHOLDER_PREFIX = "⁣MATH";
const PLACEHOLDER_SUFFIX = "⁣";

function placeholderFor(index: number): string {
  return `${PLACEHOLDER_PREFIX}${index}${PLACEHOLDER_SUFFIX}`;
}

// Escapes special regex chars in a literal placeholder so we can build a
// safe RegExp for the substitution pass.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Splits a source string into (markdown-with-placeholders, math segments).
// Follows the same delimiter rules as rich-text.tsx: `$$…$$` for display,
// `$…$` for inline, `\$` escapes a literal dollar. Unmatched openers fall
// through as plain text.
function extractMath(src: string): { text: string; math: MathSegment[] } {
  const math: MathSegment[] = [];
  let out = "";
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "\\" && src[i + 1] === "$") {
      // Preserve the escape so marked keeps the literal `$` intact.
      out += "\\$";
      i += 2;
      continue;
    }
    if (ch === "$") {
      const display = src[i + 1] === "$";
      const delim = display ? "$$" : "$";
      const start = i + delim.length;
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
        // No closing delim — treat the rest as plain markdown.
        out += src.slice(i);
        i = src.length;
        continue;
      }
      const value = src.slice(start, end);
      const idx = math.length;
      math.push({ value, display });
      out += placeholderFor(idx);
      i = end + delim.length;
      continue;
    }
    out += ch;
    i++;
  }
  return { text: out, math };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderMath({ value, display }: MathSegment): string {
  try {
    return katex.renderToString(value, {
      throwOnError: false,
      displayMode: display,
      output: "html",
    });
  } catch {
    return `<span style="color:#fb7185">${escapeHtml(value)}</span>`;
  }
}

// LRU cache keyed by raw source string. Kept small — blog previews replay
// the same source repeatedly while the editor is open, and the reader page
// benefits from short-term caching too (the memory footprint is minimal).
const RENDER_CACHE_LIMIT = 128;
const renderCache = new Map<string, string>();

export function renderBlogMarkdown(source: string): string {
  const hit = renderCache.get(source);
  if (hit !== undefined) {
    // Refresh recency for LRU behaviour.
    renderCache.delete(source);
    renderCache.set(source, hit);
    return hit;
  }

  const { text, math } = extractMath(source);

  // v18: parse is synchronous by default (no `async` extension in use).
  const parsed = marked.parse(text, { async: false });
  let html = typeof parsed === "string" ? parsed : String(parsed);

  // Substitute each placeholder with its KaTeX-rendered HTML. We do this
  // after marked has produced HTML so surrounding tags are already in
  // place (e.g. a math placeholder inside a `<p>` stays inside the `<p>`).
  for (let idx = 0; idx < math.length; idx++) {
    const placeholder = placeholderFor(idx);
    const rendered = renderMath(math[idx]);
    const re = new RegExp(escapeRegex(placeholder), "g");
    html = html.replace(re, rendered);
  }

  if (renderCache.size >= RENDER_CACHE_LIMIT) {
    const oldest = renderCache.keys().next().value;
    if (oldest !== undefined) renderCache.delete(oldest);
  }
  renderCache.set(source, html);
  return html;
}
