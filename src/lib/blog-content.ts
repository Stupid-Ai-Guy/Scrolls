import { marked } from "marked";
import katex from "katex";

// Blog bodies are either legacy markdown (old posts) or Tiptap HTML (new
// posts). Both paths run text through the same KaTeX pass so $…$ / $$…$$
// keep working regardless of storage format. Call renderBlogBody() from
// the reader; it dispatches by sniffing the leading char.

// Shared Tailwind class fragment for the rendered article's "prose" look.
// Used by the editor preview, the WYSIWYG editor canvas, and the public
// reader page so all three stay visually identical.
export const BLOG_PROSE_CLASSES =
  "text-zinc-200 leading-relaxed " +
  "[&_h1]:mt-8 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-zinc-50 " +
  "[&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-zinc-50 " +
  "[&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-zinc-100 " +
  "[&_p]:mt-4 [&_p]:leading-relaxed " +
  "[&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 " +
  "[&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 " +
  "[&_li]:mt-1 " +
  "[&_a]:text-cyan-300 [&_a]:underline hover:[&_a]:text-cyan-200 " +
  "[&_code]:bg-zinc-900 [&_code]:px-1 [&_code]:rounded [&_code]:text-[0.9em] " +
  "[&_pre]:bg-zinc-950 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:ring-1 [&_pre]:ring-zinc-800 [&_pre]:mt-4 [&_pre]:overflow-x-auto " +
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 " +
  "[&_blockquote]:border-l-2 [&_blockquote]:border-cyan-500/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:mt-4 [&_blockquote]:text-zinc-300 " +
  "[&_strong]:font-semibold [&_strong]:text-zinc-100 " +
  "[&_em]:italic " +
  "[&_hr]:my-8 [&_hr]:border-zinc-800";

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

// Sniff whether stored body content is Tiptap HTML or legacy markdown. We
// look at the first non-whitespace char; Tiptap always emits a leading tag
// (e.g. <p>, <h1>) and marked-authored content never starts with `<` for
// the schemas the editor supports today.
export function isHtmlBody(source: string): boolean {
  return /^\s*</.test(source);
}

// Applies the same math-extraction pass as renderBlogMarkdown, but only to
// the text content of an HTML string — tags and attributes are left alone.
// The tokenizer is intentionally naive; it's only asked to distinguish a
// tag from text, which the Tiptap-generated HTML we consume never nests.
function renderMathInHtml(html: string): string {
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += renderMathInText(html.slice(i));
      break;
    }
    if (lt > i) out += renderMathInText(html.slice(i, lt));
    const gt = html.indexOf(">", lt);
    if (gt === -1) {
      // Malformed — bail without further processing.
      out += html.slice(lt);
      break;
    }
    out += html.slice(lt, gt + 1);
    i = gt + 1;
  }
  return out;
}

// Runs the shared extractMath tokenizer on a plain-text run and swaps each
// placeholder for KaTeX-rendered HTML.
function renderMathInText(text: string): string {
  if (!text.includes("$")) return text;
  const { text: withPlaceholders, math } = extractMath(text);
  let out = withPlaceholders;
  for (let idx = 0; idx < math.length; idx++) {
    const placeholder = placeholderFor(idx);
    const rendered = renderMath(math[idx]);
    const re = new RegExp(escapeRegex(placeholder), "g");
    out = out.replace(re, rendered);
  }
  return out;
}

// Entry point for both the reader page and the editor preview. Legacy
// markdown posts still flow through renderBlogMarkdown; Tiptap HTML posts
// only need the math pass since the markup is already final.
export function renderBlogBody(source: string): string {
  if (!source) return "";
  if (isHtmlBody(source)) return renderMathInHtml(source);
  return renderBlogMarkdown(source);
}
