"use client";

import { useEffect, useMemo, useRef } from "react";

type TokType =
  | "keyword"
  | "function"
  | "constant"
  | "color"
  | "string"
  | "number"
  | "comment"
  | "op"
  | "ident"
  | "ws";

const STATEMENT_KEYWORDS = new Set([
  "view",
  "slider",
  "point",
  "line",
  "circle",
  "rect",
  "text",
  "check",
  "hint",
  "if",
  "elif",
  "else",
  "end",
  "and",
  "or",
  "not",
]);
const FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "sqrt",
  "abs",
  "min",
  "max",
  "floor",
  "ceil",
  "round",
]);
const PROPERTIES = new Set([
  "cords",
  "from",
  "to",
  "dims",
  "color",
  "type",
  "label",
  "id",
  "value",
]);
const CONSTANTS = new Set(["pi", "e"]);
const COLOR_NAMES = new Set([
  "slate",
  "emerald",
  "rose",
  "sky",
  "amber",
  "red",
  "blue",
  "green",
  "indigo",
  "violet",
  "gray",
  "black",
  "white",
]);

function classify(word: string): TokType {
  if (STATEMENT_KEYWORDS.has(word)) return "keyword";
  if (FUNCTIONS.has(word) || PROPERTIES.has(word)) return "function";
  if (CONSTANTS.has(word)) return "constant";
  if (COLOR_NAMES.has(word)) return "color";
  return "ident";
}

function tokenize(src: string): { type: TokType; text: string }[] {
  const out: { type: TokType; text: string }[] = [];
  let i = 0;
  let bufStart = 0;
  let bufKind: TokType = "ws";

  function flush(end: number) {
    if (end > bufStart) {
      out.push({ type: bufKind, text: src.slice(bufStart, end) });
    }
  }

  while (i < src.length) {
    const c = src[i];
    if (c === "#") {
      flush(i);
      const start = i;
      while (i < src.length && src[i] !== "\n") i++;
      out.push({ type: "comment", text: src.slice(start, i) });
      bufStart = i;
      bufKind = "ws";
      continue;
    }
    if (c === '"') {
      flush(i);
      const start = i;
      i++;
      while (i < src.length && src[i] !== '"' && src[i] !== "\n") i++;
      if (i < src.length && src[i] === '"') i++;
      out.push({ type: "string", text: src.slice(start, i) });
      bufStart = i;
      bufKind = "ws";
      continue;
    }
    if (
      /[0-9]/.test(c) ||
      (c === "." && /[0-9]/.test(src[i + 1] ?? ""))
    ) {
      flush(i);
      const start = i;
      let sawDot = false;
      while (i < src.length) {
        const ch = src[i];
        if (ch === ".") {
          if (sawDot) break;
          sawDot = true;
          i++;
          continue;
        }
        if (/[0-9]/.test(ch)) {
          i++;
          continue;
        }
        break;
      }
      out.push({ type: "number", text: src.slice(start, i) });
      bufStart = i;
      bufKind = "ws";
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      flush(i);
      const start = i;
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) i++;
      const word = src.slice(start, i);
      out.push({ type: classify(word), text: word });
      bufStart = i;
      bufKind = "ws";
      continue;
    }
    if ("+-*/^<>=!,()".includes(c)) {
      flush(i);
      let len = 1;
      const two = src.slice(i, i + 2);
      if (["<=", ">=", "==", "!="].includes(two)) len = 2;
      out.push({ type: "op", text: src.slice(i, i + len) });
      i += len;
      bufStart = i;
      bufKind = "ws";
      continue;
    }
    // whitespace or newline
    i++;
  }
  flush(i);
  return out;
}

const COLOR_CLASS: Record<TokType, string> = {
  keyword: "text-fuchsia-400",
  function: "text-cyan-300",
  constant: "text-violet-300",
  color: "text-amber-300",
  string: "text-emerald-300",
  number: "text-amber-200",
  comment: "text-zinc-600 italic",
  op: "text-zinc-400",
  ident: "text-zinc-100",
  ws: "text-zinc-100",
};

const PADDING_X = 20; // px
const PADDING_Y = 16;
const LINE_HEIGHT = 22;
const FONT_SIZE = 13;
const FONT_FAMILY =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

export default function ScrollScriptEditor({
  value,
  onChange,
  minRows = 14,
  label = "scroll.script",
}: {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
  label?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const tokens = useMemo(() => tokenize(value), [value]);
  const lines = value.split("\n").length;
  const rows = Math.max(minRows, lines + 1);

  useEffect(() => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [value]);

  function setSelection(pos: number) {
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (ta) ta.setSelectionRange(pos, pos);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    const ss = ta.selectionStart;
    const se = ta.selectionEnd;
    const before = ta.value.slice(0, ss);
    const after = ta.value.slice(se);
    const noSelection = ss === se;

    // Auto-pair brackets and quotes
    const openers: Record<string, string> = { "(": ")", '"': '"' };
    if (noSelection && e.key in openers) {
      const close = openers[e.key];
      // If typing " and next char is ", just advance past it
      if (e.key === close && after[0] === close) {
        e.preventDefault();
        setSelection(ss + 1);
        return;
      }
      e.preventDefault();
      onChange(before + e.key + close + after);
      setSelection(ss + 1);
      return;
    }

    // Skip past matching closer if it's already there
    if (noSelection && (e.key === ")" || e.key === '"') && after[0] === e.key) {
      e.preventDefault();
      setSelection(ss + 1);
      return;
    }

    // Backspace inside an empty auto-pair removes both
    if (e.key === "Backspace" && noSelection) {
      const prev = before.slice(-1);
      const next = after[0];
      const pairs: Record<string, string> = { "(": ")", '"': '"' };
      if (prev in pairs && pairs[prev] === next) {
        e.preventDefault();
        onChange(before.slice(0, -1) + after.slice(1));
        setSelection(ss - 1);
        return;
      }
    }

    // Tab inserts two spaces
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      onChange(before + "  " + after);
      setSelection(ss + 2);
      return;
    }

    // Enter: keep current indentation; add extra indent if previous line ends with "if", "elif", "else"
    if (e.key === "Enter") {
      const lineStart = before.lastIndexOf("\n") + 1;
      const currentLine = before.slice(lineStart);
      const indentMatch = currentLine.match(/^\s*/);
      const baseIndent = indentMatch ? indentMatch[0] : "";
      const trimmed = currentLine.trim();
      const opensBlock =
        /^if\b/.test(trimmed) ||
        /^elif\b/.test(trimmed) ||
        /^else\b/.test(trimmed);
      const extra = opensBlock ? "  " : "";
      if (baseIndent.length > 0 || opensBlock) {
        e.preventDefault();
        onChange(before + "\n" + baseIndent + extra + after);
        setSelection(ss + 1 + baseIndent.length + extra.length);
        return;
      }
    }
  }

  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    const ta = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
  }

  const sharedStyle: React.CSSProperties = {
    fontFamily: FONT_FAMILY,
    fontSize: FONT_SIZE,
    lineHeight: `${LINE_HEIGHT}px`,
    padding: `${PADDING_Y}px ${PADDING_X}px`,
    tabSize: 2,
  };

  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
          {label}
        </span>
      </div>

      <div className="relative">
        <pre
          ref={preRef}
          aria-hidden
          className="m-0 overflow-hidden whitespace-pre-wrap break-words"
          style={{
            ...sharedStyle,
            minHeight: `${rows * LINE_HEIGHT + PADDING_Y * 2}px`,
            pointerEvents: "none",
          }}
        >
          {tokens.map((t, i) => (
            <span key={i} className={COLOR_CLASS[t.type]}>
              {t.text}
            </span>
          ))}
          <span>{"​"}</span>
        </pre>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          suppressHydrationWarning
          rows={rows}
          className="absolute inset-0 m-0 w-full resize-none overflow-hidden border-0 bg-transparent text-transparent caret-emerald-300 outline-none"
          style={{
            ...sharedStyle,
            caretColor: "#86efac",
            whiteSpace: "pre-wrap",
            wordWrap: "break-word",
          }}
        />
      </div>
    </div>
  );
}
